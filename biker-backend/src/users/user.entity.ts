import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, UpdateDateColumn, Unique, OneToOne } from 'typeorm';
import { Biker } from '../bikers/biker.entity';

export enum UserRole {
    CUSTOMER = 'customer',
    DRIVER = 'driver',
    ADMIN = 'admin',
}

@Entity('users')
@Unique(['email', 'role'])
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => Biker, biker => biker.user)
    biker: Biker;

    @Column()
    name: string;

    @Column()
    email: string;

    // Optional contact email (does not affect backend login identity).
    @Column({ type: 'varchar', length: 320, nullable: true })
    contactEmail: string | null;

    @Column({ nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 128, nullable: true })
    city: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    country: string | null;

    @Column({ type: 'varchar', length: 8, nullable: true })
    countryCode: string | null;

    // Nullable to avoid breaking existing rows; required for new auth flows.
    @Column({ type: 'text', nullable: true })
    passwordHash: string | null;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.CUSTOMER,
    })
    role: UserRole;

    @Column({ type: 'int', default: 0 })
    walletBalanceCents: number;

    @Column({ type: 'varchar', length: 8, default: 'USD' })
    walletCurrency: string;

    @Column({ type: 'int', default: 0 })
    tokenVersion: number;

    @Column({ type: 'timestamp', nullable: true })
    disabledAt: Date | null;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status: string; // active, suspended

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    lastKnownLocation: any;

    @Index({ spatial: true })
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true,
    })
    serviceAreaCenter: any;

    @Column({ type: 'float', default: 0 })
    serviceAreaRadiusKm: number;

    @Column({ type: 'timestamp', nullable: true })
    lastKnownAt: Date | null;

    @Column({ default: 5.0, type: 'float' })
    rating: number;

    @Column({ type: 'text', nullable: true })
    photo: string;

    @Column({ type: 'json', nullable: true })
    preferences: {
        language: string;
        currency: string;
        darkMode: boolean;
    };

    @Column({ default: false })
    isVerified: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
