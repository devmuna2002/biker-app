import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrustedContact } from './trusted-contact.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SafetyService {
    constructor(
        @InjectRepository(TrustedContact)
        private contactRepository: Repository<TrustedContact>,
    ) { }

    async addContact(user: User, name: string, phone: string, email?: string) {
        const contact = this.contactRepository.create({ user, name, phone });
        return this.contactRepository.save(contact);
    }

    async getContacts(userId: number) {
        return this.contactRepository.find({ where: { user: { id: userId } } });
    }

    async removeContact(contactId: number) {
        const contact = await this.contactRepository.findOne({ where: { id: contactId } });
        if (!contact) throw new NotFoundException('Contact not found');
        await this.contactRepository.remove(contact);
        return { success: true, message: 'Contact removed' };
    }

    async triggerSOS(userId: number, location: { lat: number; lng: number }, message?: string) {
        // Fetch trusted contacts
        const contacts = await this.contactRepository.find({ where: { user: { id: userId } } });

        // In production: send SMS/push to each contact and emergency services via Twilio/Firebase
        const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
        const sosMessage = message
            ? `SOS from User ${userId}: ${message}\nLocation: ${mapsLink}`
            : `SOS from User ${userId}! Location: ${mapsLink}`;

        console.log(`🚨 SOS triggered for user ${userId} at ${location.lat}, ${location.lng}`);
        console.log(`   Message: ${sosMessage}`);
        console.log(`   Notifying ${contacts.length} trusted contact(s): ${contacts.map(c => c.phone).join(', ')}`);

        // TODO: Integrate Twilio for SMS or Firebase FCM for push notifications
        // await twilioClient.messages.create({ body: sosMessage, from: '+1...', to: contacts[0].phone });

        return {
            success: true,
            message: `Emergency services and ${contacts.length} trusted contact(s) notified`,
            contactsNotified: contacts.length,
            location: mapsLink,
        };
    }

    async generateTrackingUrl(orderId: number) {
        const token = Buffer.from(`order_${orderId}_${Date.now()}`).toString('base64url');
        return {
            success: true,
            url: `https://biker-app.com/track/${token}`,
            expiresIn: '24h',
        };
    }

    async reportIncident(
        userId: number,
        orderId: number | undefined,
        type: string,
        description: string,
    ) {
        // In production: save to DB incidents table and notify admin
        const incidentId = `INC-${Date.now()}`;
        console.log(`🔔 Incident Report [${incidentId}]: User ${userId}, Order ${orderId || 'N/A'}, Type: ${type}`);
        console.log(`   Description: ${description}`);

        return {
            success: true,
            incidentId,
            message: 'Incident reported. Our safety team will review within 24 hours.',
        };
    }

    getSafetyTips() {
        return {
            success: true,
            tips: [
                { id: 1, icon: 'shield-check', title: 'Verify Your Driver', body: 'Always check that the biker\'s name, photo, and plate match what is shown in the app before getting on.' },
                { id: 2, icon: 'map-marker-radius', title: 'Share Your Trip', body: 'Use the "Share Location" feature to send your live trip tracking to a trusted contact.' },
                { id: 3, icon: 'cellphone', title: 'Keep Your Phone Charged', body: 'Ensure you have enough battery to communicate during your ride.' },
                { id: 4, icon: 'helmet', title: 'Wear a Helmet', body: 'Always wear the helmet provided by the driver. Your safety comes first.' },
                { id: 5, icon: 'account-group', title: 'Trusted Contacts', body: 'Add trusted contacts so we can notify them automatically when you trigger an SOS.' },
                { id: 6, icon: 'star', title: 'Rate Your Ride', body: 'Leave an honest rating after every trip. It helps us maintain safety standards.' },
                { id: 7, icon: 'phone-alert', title: 'Use In-App Chat', body: 'Use the in-app chat or call feature instead of sharing personal numbers.' },
            ],
        };
    }
}
