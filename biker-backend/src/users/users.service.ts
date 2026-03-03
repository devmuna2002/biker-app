import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { Biker } from '../bikers/biker.entity';
import { pointFromLatLng } from '../common/geo';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        @InjectRepository(Biker)
        private bikersRepository: Repository<Biker>,
        private readonly notifications: NotificationsService,
    ) { }

    findAll() {
        return this.usersRepository.find();
    }

    findOne(id: number) {
        return this.usersRepository.findOne({ where: { id }, relations: ['biker'] });
    }

    async findOneById(id: number) {
        const user = await this.usersRepository.findOne({ where: { id }, relations: ['biker'] });
        return user;
    }

    async updateLastKnownLocation(userId: number, lat: number, lng: number) {
        await this.usersRepository.update(userId, {
            lastKnownLocation: pointFromLatLng(lat, lng) as any,
            lastKnownAt: new Date(),
        } as any);
    }

    create(user: Partial<User>) {
        return this.usersRepository.save(user);
    }

    update(id: number, user: Partial<User>) {
        return this.usersRepository.update(id, user);
    }

    async updateMe(id: number, user: Partial<User> & any) {
        const patch: any = { ...(user as any) };

        // Never allow updating the backend login identity via this endpoint.
        delete patch.email;

        if (typeof patch.serviceAreaLat === 'number' && typeof patch.serviceAreaLng === 'number') {
            patch.serviceAreaCenter = pointFromLatLng(patch.serviceAreaLat, patch.serviceAreaLng) as any;
        }
        delete patch.serviceAreaLat;
        delete patch.serviceAreaLng;

        // Extract biker-specific fields
        const bikerFields = [
            'vehicleType',
            'vehicleNumber',
            'vehicleDetails',
            'paymentMethodPreference',
            'mobileMoneyNumber',
            'paypalEmail',
            'licenseVerificationPhoto',
        ];

        const bikerPatch: any = {};
        for (const field of bikerFields) {
            if (patch[field] !== undefined) {
                bikerPatch[field] = patch[field];
                delete patch[field];
            }
        }

        // Update User table
        if (Object.keys(patch).length > 0) {
            await this.usersRepository.update(id, patch as any);
        }

        // Update Biker table if biker fields are present
        if (Object.keys(bikerPatch).length > 0) {
            let biker = await this.bikersRepository.findOne({ where: { user: { id } as any } });
            if (biker) {
                // If license photo is uploaded, reset status to pending for admin review
                if (bikerPatch.licenseVerificationPhoto) {
                    bikerPatch.verificationStatus = 'pending';

                    // Notify Admins
                    try {
                        const admins = await this.usersRepository.find({ where: { role: UserRole.ADMIN } });
                        const driver = await this.usersRepository.findOne({ where: { id } });
                        for (const admin of admins) {
                            await this.notifications.create(
                                admin,
                                'driver_verification',
                                `Driver ${driver?.name || 'Unknown'} has uploaded a new license photo for verification.`
                            );
                        }
                    } catch (e) {
                        console.error('[UsersService] Failed to notify admins of driver verification', e?.message);
                    }
                }
                await this.bikersRepository.update(biker.id, bikerPatch);
            } else {
                // Create biker record if it doesn't exist (e.g. user was previously only a customer)
                const trialDays = 30;
                const trialExpiryAt = new Date();
                trialExpiryAt.setDate(trialExpiryAt.getDate() + trialDays);

                const newBiker = this.bikersRepository.create({
                    user: { id } as any,
                    ...bikerPatch,
                    trialExpiryDate: trialExpiryAt,
                    verificationStatus: bikerPatch.licenseVerificationPhoto ? 'pending' : 'pending',
                });
                await this.bikersRepository.save(newBiker);

                // If they uploaded a photo during creation, notify admins
                if (bikerPatch.licenseVerificationPhoto) {
                    try {
                        const admins = await this.usersRepository.find({ where: { role: UserRole.ADMIN } });
                        const driver = await this.usersRepository.findOne({ where: { id } });
                        for (const admin of admins) {
                            await this.notifications.create(
                                admin,
                                'driver_verification',
                                `New Driver ${driver?.name || 'Unknown'} has registered and uploaded a license photo for verification.`
                            );
                        }
                    } catch { }
                }
            }
        }

        return this.usersRepository.findOne({ where: { id }, relations: ['biker'] });
    }

    async verifyOTP(phone: string, code: string) {
        // Mock OTP verification logic
        console.log(`Verifying OTP ${code} for phone ${phone}`);
        return { success: true, message: 'OTP verified successfully' };
    }
}
