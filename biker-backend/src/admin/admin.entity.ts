import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RiderStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    SUSPENDED = 'suspended',
    REJECTED = 'rejected',
}

export enum AdminRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
    MODERATOR = 'moderator',
}

@Entity('riders')
export class Rider {
    @PrimaryGeneratedColumn('uuid')
    rider_id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 20, unique: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string;

    @Column({ name: 'password_hash', type: 'varchar', length: 255 })
    password_hash: string;

    @Column({ name: 'profile_image', type: 'text', nullable: true })
    profile_image: string;

    @Column({ name: 'id_document', type: 'varchar', length: 255, nullable: true })
    id_document: string;

    @Column({ name: 'id_document_verified', type: 'boolean', default: false })
    id_document_verified: boolean;

    @Column({ name: 'bike_plate', type: 'varchar', length: 20, nullable: true })
    bike_plate: string;

    @Column({ name: 'bike_model', type: 'varchar', length: 100, nullable: true })
    bike_model: string;

    @Column({ name: 'bike_color', type: 'varchar', length: 50, nullable: true })
    bike_color: string;

    @Column({ name: 'vehicle_type', type: 'varchar', length: 50, default: 'motorcycle' })
    vehicle_type: string;

    @Column({ type: 'varchar', length: 20, default: RiderStatus.PENDING })
    status: RiderStatus;

    @Column({ name: 'is_online', type: 'boolean', default: false })
    is_online: boolean;

    @Column({ name: 'is_available', type: 'boolean', default: false })
    is_available: boolean;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.00 })
    rating: number;

    @Column({ name: 'total_trips', type: 'int', default: 0 })
    total_trips: number;

    @Column({ name: 'acceptance_rate', type: 'decimal', precision: 5, scale: 2, default: 100.00 })
    acceptance_rate: number;

    @Column({ name: 'last_latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
    last_latitude: number;

    @Column({ name: 'last_longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
    last_longitude: number;

    @Column({ name: 'last_location_update', type: 'timestamp', nullable: true })
    last_location_update: Date;

    @Column({ name: 'fcm_token', type: 'text', nullable: true })
    fcm_token: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}

@Entity('customers')
export class Customer {
    @PrimaryGeneratedColumn('uuid')
    customer_id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 20, unique: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string;

    @Column({ name: 'password_hash', type: 'varchar', length: 255 })
    password_hash: string;

    @Column({ name: 'profile_image', type: 'text', nullable: true })
    profile_image: string;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status: string;

    @Column({ name: 'fcm_token', type: 'text', nullable: true })
    fcm_token: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}
