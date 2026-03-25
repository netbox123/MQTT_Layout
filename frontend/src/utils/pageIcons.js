import {
  // Rooms & Areas
  mdiHome, mdiHomeOutline, mdiFloorPlan,
  mdiSofa, mdiBed, mdiBathtub, mdiShower,
  mdiSilverwareForkKnife, mdiBookshelf,
  mdiGarage, mdiGarageOpen,
  mdiDumbbell, mdiBabyCarriage, mdiGamepadVariant,
  mdiWashingMachine, mdiDesk, mdiStairs, mdiDoorClosed,
  // Climate & Energy
  mdiLightbulb, mdiLightbulbOutline, mdiLightbulbGroup,
  mdiPowerPlug, mdiLightningBolt,
  mdiBattery, mdiBatteryHigh, mdiSolarPower,
  mdiThermometer, mdiGauge, mdiChip, mdiFire, mdiRadiator,
  mdiSnowflake, mdiFan, mdiAirConditioner, mdiHeatPump,
  mdiWater, mdiWaterBoiler, mdiWeatherWindy,
  mdiWhiteBalanceSunny, mdiSmokeDetector,
  // Security
  mdiLock, mdiLockOpen, mdiKey,
  mdiCctv, mdiCamera, mdiBell, mdiBellRing,
  mdiAlarmLight, mdiShieldHome,
  // Nature & Outdoor
  mdiLeaf, mdiTree, mdiPineTree, mdiFlower,
  mdiWaves, mdiSprout, mdiGrass,
  mdiWeatherSunny, mdiWeatherRainy, mdiWeatherSnowy,
  // Media & Tech
  mdiTelevision, mdiMusicNote, mdiMonitor,
  mdiCellphone, mdiTablet, mdiSpeaker,
  mdiRemoteTv, mdiRouterWireless,
  // Misc
  mdiClock, mdiCalendar, mdiCog, mdiTools, mdiWeb,
  mdiCar, mdiCarElectric,
  mdiMapMarker, mdiStar, mdiHeart,
  mdiPaw, mdiMedicalBag, mdiInformation,
} from '@mdi/js';

export const ICON_CATEGORIES = [
  {
    label: 'Rooms & Areas',
    icons: [
      { key: 'home',              path: mdiHome },
      { key: 'home-outline',      path: mdiHomeOutline },
      { key: 'floor-plan',        path: mdiFloorPlan },
      { key: 'sofa',              path: mdiSofa },
      { key: 'bed',               path: mdiBed },
      { key: 'bathtub',           path: mdiBathtub },
      { key: 'shower',            path: mdiShower },
      { key: 'silverware',        path: mdiSilverwareForkKnife },
      { key: 'bookshelf',         path: mdiBookshelf },
      { key: 'garage',            path: mdiGarage },
      { key: 'garage-open',       path: mdiGarageOpen },
      { key: 'dumbbell',          path: mdiDumbbell },
      { key: 'baby-carriage',     path: mdiBabyCarriage },
      { key: 'gamepad',           path: mdiGamepadVariant },
      { key: 'washing-machine',   path: mdiWashingMachine },
      { key: 'desk',              path: mdiDesk },
      { key: 'stairs',            path: mdiStairs },
      { key: 'door-closed',       path: mdiDoorClosed },
    ],
  },
  {
    label: 'Climate & Energy',
    icons: [
      { key: 'lightbulb',         path: mdiLightbulb },
      { key: 'lightbulb-outline', path: mdiLightbulbOutline },
      { key: 'lightbulb-group',   path: mdiLightbulbGroup },
      { key: 'power-plug',        path: mdiPowerPlug },
      { key: 'lightning-bolt',    path: mdiLightningBolt },
      { key: 'battery',           path: mdiBattery },
      { key: 'battery-high',      path: mdiBatteryHigh },
      { key: 'solar-power',       path: mdiSolarPower },
      { key: 'thermometer',       path: mdiThermometer },
      { key: 'gauge',             path: mdiGauge },
      { key: 'chip',              path: mdiChip },
      { key: 'fire',              path: mdiFire },
      { key: 'radiator',          path: mdiRadiator },
      { key: 'snowflake',         path: mdiSnowflake },
      { key: 'fan',               path: mdiFan },
      { key: 'air-conditioner',   path: mdiAirConditioner },
      { key: 'heat-pump',         path: mdiHeatPump },
      { key: 'water',             path: mdiWater },
      { key: 'water-boiler',      path: mdiWaterBoiler },
      { key: 'weather-windy',     path: mdiWeatherWindy },
      { key: 'sunny',             path: mdiWhiteBalanceSunny },
      { key: 'smoke-detector',    path: mdiSmokeDetector },
    ],
  },
  {
    label: 'Security',
    icons: [
      { key: 'lock',              path: mdiLock },
      { key: 'lock-open',         path: mdiLockOpen },
      { key: 'key',               path: mdiKey },
      { key: 'cctv',              path: mdiCctv },
      { key: 'camera',            path: mdiCamera },
      { key: 'bell',              path: mdiBell },
      { key: 'bell-ring',         path: mdiBellRing },
      { key: 'alarm-light',       path: mdiAlarmLight },
      { key: 'shield-home',       path: mdiShieldHome },
    ],
  },
  {
    label: 'Nature & Outdoor',
    icons: [
      { key: 'leaf',              path: mdiLeaf },
      { key: 'tree',              path: mdiTree },
      { key: 'pine-tree',         path: mdiPineTree },
      { key: 'flower',            path: mdiFlower },
      { key: 'waves',             path: mdiWaves },
      { key: 'sprout',            path: mdiSprout },
      { key: 'grass',             path: mdiGrass },
      { key: 'weather-sunny',     path: mdiWeatherSunny },
      { key: 'weather-rainy',     path: mdiWeatherRainy },
      { key: 'weather-snowy',     path: mdiWeatherSnowy },
    ],
  },
  {
    label: 'Media & Tech',
    icons: [
      { key: 'television',        path: mdiTelevision },
      { key: 'music-note',        path: mdiMusicNote },
      { key: 'monitor',           path: mdiMonitor },
      { key: 'cellphone',         path: mdiCellphone },
      { key: 'tablet',            path: mdiTablet },
      { key: 'speaker',           path: mdiSpeaker },
      { key: 'remote-tv',         path: mdiRemoteTv },
      { key: 'router-wireless',   path: mdiRouterWireless },
    ],
  },
  {
    label: 'Custom',
    icons: [
      {
        key: 'victron',
        path: 'M19.0167 3.49379C19.0167 3.49379 13.6937 1.42977 8.37071 5.77506C8.37071 5.77506 1.96141 10.0117 0.766454 28.1533C0.766454 28.1533 0.440557 31.195 3.04773 31.6295C3.04773 31.6295 5.76354 32.1727 6.08944 29.8914C6.41533 27.6101 6.41533 16.2038 11.4124 10.3376C11.4124 10.3376 11.9556 9.57719 13.2592 9.03403C14.3455 8.38224 15.2145 7.07865 15.975 6.10096C15.975 5.99233 16.9527 4.68874 19.0167 3.49379Z M28.5773 3.05673C28.5773 3.05673 23.9061 1.53587 18.8004 5.44664C18.8004 5.44664 12.717 9.14013 11.3048 23.8055C11.3048 23.8055 10.7616 27.3904 11.0875 29.2371C11.0875 29.2371 11.3048 31.4097 13.4774 31.5184C13.4774 31.5184 16.1932 31.7356 16.3019 29.2371C16.5191 26.7386 16.5191 25.7609 16.5191 25.7609C16.5191 25.7609 16.9537 15.984 20.8644 11.0955L21.8421 11.8559C21.9508 11.8559 23.363 6.75022 28.5773 3.05673Z M38.2444 3.05758C38.2444 3.05758 31.9438 1.53673 27.3812 6.53382C27.3812 6.53382 22.8187 10.5532 21.5151 20.656C21.5151 20.656 20.9719 26.0876 20.8633 28.6948C20.8633 28.6948 20.8633 31.1933 23.2532 31.5192C23.2532 31.5192 25.7517 31.6279 25.969 29.0207C25.969 29.0207 26.1863 16.7453 30.7488 11.0964L31.8351 11.7482C31.7265 11.8568 33.6819 6.09929 38.2444 3.05758Z M45.5231 2.94826C45.5231 2.94826 39.1138 2.73099 35.4203 9.1403C35.4203 9.1403 31.075 15.441 31.075 28.2596C31.075 28.2596 30.8577 31.3013 33.2476 31.6272C33.2476 31.6272 36.0721 31.8444 36.0721 28.5855C36.0721 28.5855 36.1807 15.8755 41.0691 10.7698C41.0691 10.7698 45.4144 15.8755 45.7403 28.0423C45.7403 28.0423 45.849 36.407 47.4784 40.9696C47.4784 40.9696 48.8907 35.8638 49.2166 28.6941C49.2166 28.6941 49.1079 27.3905 50.1943 26.5215C50.1943 26.5215 50.9547 26.1956 50.846 24.892C50.846 24.892 49.7597 14.3546 46.2835 8.27124C46.2835 8.27124 53.7791 7.83671 55.1913 22.7193C55.1913 22.7193 55.1913 24.892 56.3863 26.3042C56.3863 26.3042 57.2553 26.956 57.364 28.4768C57.364 28.4768 57.5812 30.5409 56.9295 37.3847C56.9295 37.3847 56.8208 38.9055 57.4726 40.9696C57.4726 40.9696 59.3194 35.8638 58.8848 30.8668C58.8848 30.8668 58.6676 26.8474 60.6229 25.4351C60.6229 25.4351 60.4057 14.1374 55.9518 7.83671C55.8431 7.83671 52.2583 2.62236 45.5231 2.94826Z M67.7925 54.3329C67.7925 54.3329 73.1155 56.3969 78.4384 52.0516C78.4384 52.0516 84.8477 47.815 86.0427 29.6734C86.0427 29.6734 86.3686 26.6317 83.7614 26.1971C83.7614 26.1971 81.0456 25.654 80.7197 27.9353C80.3938 30.2165 80.3938 41.6229 75.3967 47.4891C75.3967 47.4891 74.8536 48.2495 73.55 48.7927C72.4637 49.4445 71.5946 50.748 70.8342 51.7257C70.8342 51.7257 69.8565 53.0293 67.7925 54.3329Z M58.1245 54.7672C58.1245 54.7672 62.7957 56.2881 67.9014 52.3773C67.9014 52.3773 73.9848 48.6838 75.397 34.0184C75.397 34.0184 75.9402 30.4336 75.6143 28.5868C75.6143 28.5868 75.397 26.4142 73.2244 26.3055C73.2244 26.3055 70.5086 26.0883 70.4 28.5868C70.1827 31.0854 70.1827 32.0631 70.1827 32.0631C70.1827 32.0631 69.7482 41.84 65.8374 46.7284L64.8597 45.968C64.8597 45.968 63.4475 51.0737 58.1245 54.7672Z M48.5649 54.767C48.5649 54.767 54.8656 56.2878 59.4282 51.2908C59.4282 51.2908 63.9907 47.2714 65.2943 37.1686C65.2943 37.1686 65.8375 31.7369 65.9461 29.1298C65.9461 29.1298 65.9461 26.6312 63.5562 26.3053C63.5562 26.3053 61.0577 26.1967 60.8404 28.8039C60.8404 28.8039 60.6231 41.0793 56.0606 46.7282L54.9742 46.0764C55.0829 45.9678 53.1275 51.7253 48.5649 54.767Z M41.2874 54.8768C41.2874 54.8768 47.6967 55.094 51.3902 48.6847C51.3902 48.6847 55.7355 42.3841 55.7355 29.5654C55.7355 29.5654 55.9527 26.5237 53.5628 26.1978C53.5628 26.1978 50.7384 25.9806 50.7384 29.2395C50.7384 29.2395 50.6298 41.9495 45.7413 47.0552C45.7413 47.0552 41.396 41.9495 41.0701 29.7827C41.0701 29.7827 40.9615 21.418 39.332 16.8555C39.332 16.8555 37.9198 21.9612 37.5939 29.1309C37.5939 29.1309 37.7025 30.4345 36.6162 31.3036C36.6162 31.3036 35.8558 31.6295 35.9644 32.933C35.9644 32.933 37.0507 43.4704 40.527 49.5538C40.527 49.5538 33.0313 49.9883 31.6191 35.1057C31.6191 35.1057 31.6191 32.933 30.4242 31.5208C30.4242 31.5208 29.5551 30.869 29.4465 29.3482C29.4465 29.3482 29.2292 27.2842 29.881 20.4403C29.881 20.4403 29.9896 18.9195 29.3378 16.8555C29.3378 16.8555 27.4911 21.9612 27.9256 26.9583C27.9256 26.9583 28.1429 30.9777 26.1875 32.3899C26.1875 32.3899 26.4048 43.6876 30.8587 49.9883C30.9673 49.9883 34.5522 55.094 41.2874 54.8768Z',
      },
    ],
  },
  {
    label: 'Other',
    icons: [
      { key: 'clock',             path: mdiClock },
      { key: 'calendar',          path: mdiCalendar },
      { key: 'cog',               path: mdiCog },
      { key: 'tools',             path: mdiTools },
      { key: 'web',               path: mdiWeb },
      { key: 'car',               path: mdiCar },
      { key: 'car-electric',      path: mdiCarElectric },
      { key: 'map-marker',        path: mdiMapMarker },
      { key: 'star',              path: mdiStar },
      { key: 'heart',             path: mdiHeart },
      { key: 'paw',               path: mdiPaw },
      { key: 'medical-bag',       path: mdiMedicalBag },
      { key: 'information',       path: mdiInformation },
    ],
  },
];

// Custom icons that need a non-standard viewBox (key → viewBox string)
export const ICON_VIEWBOXES = {
  'victron': '0 0 87 57',
};

// Flat map: key → path, for rendering icons by name
export const ICON_MAP = Object.fromEntries(
  ICON_CATEGORIES.flatMap(c => c.icons.map(i => [i.key, i.path]))
);
