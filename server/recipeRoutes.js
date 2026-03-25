import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = path.join(__dirname, '../config/recipes');
const IMAGES_DIR  = path.join(RECIPES_DIR, 'images');

fs.mkdirSync(RECIPES_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR,  { recursive: true });

function slug(title) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadRecipe(id) {
  const file = path.join(RECIPES_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveRecipe(id, data) {
  fs.writeFileSync(path.join(RECIPES_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

function allRecipes() {
  return fs.readdirSync(RECIPES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), 'utf-8')))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (req, file, cb) => cb(null, req.params.id + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// Serve images — must be before /:id route
router.get('/images/:file', (req, res) => {
  const file = path.join(IMAGES_DIR, req.params.file);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.sendFile(file);
});

router.get('/', (req, res) => res.json(allRecipes()));

router.get('/:id', (req, res) => {
  const recipe = loadRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  res.json(recipe);
});

router.post('/', (req, res) => {
  const { title, servings, ingredients, steps, tags } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const id = slug(title);
  if (fs.existsSync(path.join(RECIPES_DIR, `${id}.json`)))
    return res.status(409).json({ error: 'A recipe with this title already exists' });
  const recipe = { id, title: title.trim(), servings: Number(servings) || 0, ingredients: ingredients || [], steps: steps || [], tags: tags || [], image: '' };
  saveRecipe(id, recipe);
  res.status(201).json(recipe);
});

router.put('/:id', (req, res) => {
  const recipe = loadRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  const { title, servings, ingredients, steps, tags } = req.body;
  const updated = { ...recipe, title: title ?? recipe.title, servings: Number(servings) || recipe.servings, ingredients: ingredients ?? recipe.ingredients, steps: steps ?? recipe.steps, tags: tags ?? recipe.tags };
  saveRecipe(req.params.id, updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const recipe = loadRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(path.join(RECIPES_DIR, `${req.params.id}.json`));
  if (recipe.image) {
    const imgPath = path.join(IMAGES_DIR, recipe.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  res.json({ ok: true });
});

router.post('/:id/image', upload.single('image'), (req, res) => {
  const recipe = loadRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  if (recipe.image && recipe.image !== req.file.filename) {
    const old = path.join(IMAGES_DIR, recipe.image);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  recipe.image = req.file.filename;
  saveRecipe(req.params.id, recipe);
  res.json({ image: req.file.filename });
});

export default router;
