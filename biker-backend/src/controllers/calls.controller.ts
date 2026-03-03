import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { Public } from '../common/public.decorator';

// Simple in-memory call log (persists per server session).
// For production, this would be a proper DB entity.
const callStore: any[] = [];

@Controller('api/calls')
export class CallsController {
    @Public()
    @Get('biker/:userId')
    getForBiker(@Param('userId') userId: string) {
        const id = Number(userId);
        const calls = callStore
            .filter(c => c.userId === id || c.recipientId === String(id))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50);
        return { success: true, data: calls };
    }

    @Post('record')
    record(@Body() body: any) {
        const entry = {
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: body.userId,
            recipientId: body.recipientId,
            name: body.name || 'Unknown',
            phoneNumber: body.phoneNumber || '',
            type: body.type || 'outgoing',
            timestamp: body.startTime || new Date().toISOString(),
            duration: body.duration || null,
        };
        callStore.unshift(entry);
        // Keep memory store bounded
        if (callStore.length > 2000) callStore.splice(1000);
        return { success: true, data: entry };
    }
}
