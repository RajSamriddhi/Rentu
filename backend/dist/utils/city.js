"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CITIES = void 0;
exports.extractCity = extractCity;
exports.CITIES = ['Delhi', 'Bangalore', 'Mumbai'];
function extractCity(locality) {
    if (!locality)
        return 'Delhi';
    const loc = locality.toLowerCase();
    if (loc.includes('bangalore') ||
        loc.includes('bengaluru') ||
        loc.includes('koramangala') ||
        loc.includes('kengeri') ||
        loc.includes('indiranagar') ||
        loc.includes('whitefield') ||
        loc.includes('hsr')) {
        return 'Bangalore';
    }
    if (loc.includes('mumbai') ||
        loc.includes('bandra') ||
        loc.includes('powai') ||
        loc.includes('andheri') ||
        loc.includes('juhu') ||
        loc.includes('colaba')) {
        return 'Mumbai';
    }
    return 'Delhi';
}
