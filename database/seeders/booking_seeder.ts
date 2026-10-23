import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import BookingStatus from '#enums/booking_status'
import UserRole from '#enums/user_role'
import Booking from '#models/booking'
import User from '#models/user'

const PASSWORD = 'password123'

/** The demo client whose dashboard + "My bookings" the mobile app shows. */
const CLIENT = {
  firstName: 'Zainab',
  lastName: 'Ahmed',
  email: 'client@betawork.app',
  phoneNumber: '+2348120000001',
  city: 'Wuse',
  state: 'Abuja',
  address: '41 Amino Crescent, Wuse 2',
}

type BookingSeed = {
  artisanEmail: string
  status: BookingStatus
  trade: string
  service: string
  jobDescription: string
  budget: number
  languages: string
  messageToArtisan: string
  scheduledAt: DateTime
  location: string
  address: string
  awaitingConfirmation?: boolean
  cancelledBy?: string
  cancellationReason?: string
  cancelledAt?: DateTime
}

const now = DateTime.now()

/** Bookings link the demo client to the approved artisans the artisan seeder creates. */
const BOOKINGS: BookingSeed[] = [
  {
    artisanEmail: 'tunde.adeyemi@betawork.app',
    status: BookingStatus.PENDING,
    trade: 'Plumber',
    service: 'Pipe repair and replacement',
    jobDescription:
      'Slow draining in the kitchen sink, possibly a blockage, and a persistent drip in the guest bathroom faucet.',
    budget: 40000,
    languages: 'English and Yoruba',
    messageToArtisan: 'Please call me when you get to the bus stop.',
    scheduledAt: now.plus({ days: 3 }).set({ hour: 11, minute: 0 }),
    location: '41 Amino crescent wood, Wuse 2.',
    address: '145 Adetokunbo Ademola Crescent',
  },
  {
    artisanEmail: 'funke.ogunleye@betawork.app',
    status: BookingStatus.ACCEPTED,
    trade: 'Hairstylist',
    service: 'Corn rows braiding',
    jobDescription:
      'Full corn rows with extensions for a weekend wedding. Please bring your own hair dryer.',
    budget: 25000,
    languages: 'English and Hausa',
    messageToArtisan: 'The gate code is 4402, ring the bell twice.',
    scheduledAt: now.plus({ days: 1 }).set({ hour: 11, minute: 0 }),
    location: '41 Amino crescent wood, Wuse 2.',
    address: '145 Adetokunbo Ademola Crescent',
  },
  {
    artisanEmail: 'chinedu.okafor@betawork.app',
    status: BookingStatus.ONGOING,
    trade: 'Electrician',
    service: 'Full apartment rewiring',
    jobDescription: 'Replace old wiring in the living room and kitchen, and add two new sockets.',
    budget: 60000,
    languages: 'English and Igbo',
    messageToArtisan: 'Power is on a prepaid meter, let me know if you need units.',
    scheduledAt: now.set({ hour: 9, minute: 0 }),
    location: '41 Amino crescent wood, Wuse 2.',
    address: '145 Adetokunbo Ademola Crescent',
  },
  {
    artisanEmail: 'aisha.bello@betawork.app',
    status: BookingStatus.ONGOING,
    trade: 'Painter',
    service: 'Living room repaint',
    jobDescription: 'Repaint the living room in a warm off-white, one accent wall in terracotta.',
    budget: 35000,
    languages: 'English',
    messageToArtisan: 'I will be home from noon.',
    scheduledAt: now.minus({ days: 1 }).set({ hour: 13, minute: 0 }),
    location: '21 east west side, New Nyanya.',
    address: '21 East West Side, New Nyanya',
    awaitingConfirmation: true,
  },
  {
    artisanEmail: 'ngozi.eze@betawork.app',
    status: BookingStatus.COMPLETED,
    trade: 'Tailor',
    service: 'Traditional outfit tailoring',
    jobDescription: 'Sew a three-piece agbada for a naming ceremony. Measurements attached.',
    budget: 18000,
    languages: 'English and Igbo',
    messageToArtisan: 'Thank you, it fit perfectly!',
    scheduledAt: now.minus({ days: 10 }).set({ hour: 18, minute: 0 }),
    location: '21 east west side, New Nyanya.',
    address: '21 East West Side, New Nyanya',
  },
  {
    artisanEmail: 'tunde.adeyemi@betawork.app',
    status: BookingStatus.CANCELLED,
    trade: 'Plumber',
    service: 'Water heater installation',
    jobDescription: 'Install a new 20L water heater in the main bathroom.',
    budget: 30000,
    languages: 'English and Yoruba',
    messageToArtisan: 'Please call me when you get to the bus stop.',
    scheduledAt: now.minus({ days: 5 }).set({ hour: 11, minute: 0 }),
    location: '41 Amino crescent wood, Wuse 2.',
    address: '145 Adetokunbo Ademola Crescent',
    cancelledBy: 'Tunde',
    cancellationReason: "I'm not available on that date.",
    cancelledAt: now.minus({ days: 6 }).set({ hour: 11, minute: 22 }),
  },
]

export default class extends BaseSeeder {
  async run() {
    const client = await User.updateOrCreate(
      { email: CLIENT.email },
      {
        firstName: CLIENT.firstName,
        lastName: CLIENT.lastName,
        email: CLIENT.email,
        phoneNumber: CLIENT.phoneNumber,
        password: PASSWORD,
        city: CLIENT.city,
        state: CLIENT.state,
        address: CLIENT.address,
        role: UserRole.USER,
      }
    )

    // Idempotent: clear the demo client's bookings before reseeding.
    await Booking.query().where('clientId', client.id).delete()

    for (const seed of BOOKINGS) {
      const artisan = await User.findBy('email', seed.artisanEmail)
      if (!artisan) {
        // The artisan seeder must run first; skip gracefully if it has not.
        continue
      }

      await Booking.create({
        clientId: client.id,
        artisanId: artisan.id,
        status: seed.status,
        trade: seed.trade,
        service: seed.service,
        jobDescription: seed.jobDescription,
        budget: seed.budget,
        languages: seed.languages,
        messageToArtisan: seed.messageToArtisan,
        scheduledAt: seed.scheduledAt,
        location: seed.location,
        address: seed.address,
        awaitingConfirmation: seed.awaitingConfirmation ?? false,
        cancelledBy: seed.cancelledBy ?? null,
        cancellationReason: seed.cancellationReason ?? null,
        cancelledAt: seed.cancelledAt ?? null,
      })
    }
  }
}
