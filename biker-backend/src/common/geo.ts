export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}

export function pointFromLatLng(lat: number, lng: number) {
    return { type: 'Point', coordinates: [lng, lat] };
}

export function latLngFromPoint(point: any): { lat: number; lng: number } | null {
    const coords = point?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return { lng: Number(coords[0]), lat: Number(coords[1]) };
}
