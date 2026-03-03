import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PricingService {
    calculate(input: {
        pickupLat: number;
        pickupLng: number;
        dropoffLat: number;
        dropoffLng: number;
        distance?: number;
    }) {
        // Use distance from frontend (already calculated via OSRM)
        // Or calculate from coordinates if not provided
        let distanceKm: number;
        
        if (input.distance && input.distance > 0) {
            // Use OSRM distance from frontend
            distanceKm = input.distance;
        } else {
            // Fallback: use straight-line (not recommended)
            // For proper pricing, always pass distance from OSRM
            const R = 6371; // Earth's radius in km
            const dLat = this.toRad(input.dropoffLat - input.pickupLat);
            const dLng = this.toRad(input.dropoffLng - input.pickupLng);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(this.toRad(input.pickupLat)) * Math.cos(this.toRad(input.dropoffLat)) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distanceKm = R * c;
        }
        
        const roundedKm = Math.round(distanceKm * 100) / 100;

        // Formula: price = distance_km / 1.3
        const priceDollars = roundedKm / 1.3;
        const priceCents = Math.round(priceDollars * 100);

        // Minimum fare of $1 (100 cents)
        const minFareCents = 100;
        const finalPriceCents = Math.max(minFareCents, priceCents);

        // Estimate ETA: ~3 minutes per km
        const etaMinutes = Math.max(1, Math.round(roundedKm * 3));

        return {
            success: true,
            data: {
                distanceKm: roundedKm,
                etaMinutes: etaMinutes,
                currency: 'USD',
                priceCents: finalPriceCents,
                formula: 'distance_km / 1.3',
                breakdown: {
                    distanceKm: roundedKm,
                    pricePerKm: Math.round((1 / 1.3) * 100),
                    calculatedPrice: priceCents,
                    minFare: minFareCents,
                    finalPrice: finalPriceCents,
                },
            },
        };
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
