export type ZonePreset = {
  id: string;
  name: string;
  defaultRadiusMeters: number;
  preset: true;
};

export const GEOFENCE_RADIUS_PRESETS = [10, 20, 50, 100, 200, 500] as const;

export const ZONE_PRESETS: ZonePreset[] = [
  {
    id: 'libreville-centre',
    name: 'Libreville Centre',
    defaultRadiusMeters: 200,
    preset: true,
  },
  {
    id: 'akanda',
    name: 'Akanda',
    defaultRadiusMeters: 200,
    preset: true,
  },
  {
    id: 'owendo',
    name: 'Owendo',
    defaultRadiusMeters: 500,
    preset: true,
  },
  {
    id: 'zone-port',
    name: 'Zone Port',
    defaultRadiusMeters: 100,
    preset: true,
  },
  {
    id: 'zone-aeroport',
    name: 'Zone Aeroport',
    defaultRadiusMeters: 500,
    preset: true,
  },
];
