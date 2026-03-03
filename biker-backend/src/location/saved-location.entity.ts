import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('saved_locations')
export class SavedLocation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => User)
    user: User;

    @Column({ type: 'varchar', length: 64, default: 'recent' })
    kind: string; // recent, home, work, favorite

    @Column({ type: 'varchar', length: 256 })
    label: string;

    @Column({ type: 'float' })
    lat: number;

    @Column({ type: 'float' })
    lng: number;

    @Column({ type: 'varchar', length: 512, nullable: true })
    address: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
