import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Selo IO <onboarding@resend.dev>'
