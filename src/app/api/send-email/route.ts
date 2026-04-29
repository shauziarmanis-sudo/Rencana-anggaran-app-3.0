// ============================================================
// API Route: Send Approval Email
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { appendToLogSheet } from '@/lib/googleSheets';
import { generateApprovalEmail } from '@/lib/emailTemplate';
import { getEmailSubject } from '@/lib/constants';
import { getTodayIndonesia } from '@/lib/format';
import fs from 'fs';
import path from 'path';
import type { RekapVendorGroup } from '@/types/finance';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      to,
      cc,
      directorName,
      companyGroups,
      grandTotal,
      totalPI,
      piList,
      piIds,
      senderName,
    } = body as {
      to: string;
      cc?: string;
      directorName: string;
      companyGroups: any[];
      grandTotal: number;
      totalPI: number;
      piList: string[];
      piIds?: string[];
      senderName?: string;
    };

    // Validate required fields
    const isDummy = companyGroups && companyGroups.length === 0;
    if (!isDummy && (!to || !directorName || !companyGroups || companyGroups.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, directorName, companyGroups' },
        { status: 400 }
      );
    }

    // Generate email HTML
    const htmlBody = generateApprovalEmail({
      directorName,
      companyGroups,
      grandTotal,
      totalPI,
      senderName,
    });

    // Calculate invoice stats
    let invoiceFoundCount = 0;
    let invoiceNotFoundCount = 0;
    companyGroups.forEach(cg => {
      cg.vendorGroups.forEach((g: any) => {
        g.rows.forEach((r: any) => {
          if (r.invoiceLinks && r.invoiceLinks.length > 0) {
            invoiceFoundCount++;
          } else {
            invoiceNotFoundCount++;
          }
        });
      });
    });

    // Failsafe: Manually parse .env from filesystem in case Next.js build cache locked the old empty values.
    let smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
    let smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
    
    if (!smtpUser || !smtpPass) {
      try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          envContent.split('\n').forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('SMTP_USER=')) smtpUser = cleanLine.substring(10).trim();
            if (cleanLine.startsWith('SMTP_PASS=')) smtpPass = cleanLine.substring(10).trim();
          });
        }
      } catch(e) {
        console.error("Manual env parse failed:", e);
      }
    }
    
    console.log('--- NEXT.JS SMTP DEBUG ---');
    console.log('USER:', smtpUser || 'MISSING');
    console.log('PASS LENGTH:', smtpPass ? smtpPass.length : 0);
    console.log('--------------------------');

    // Configure SMTP transport natively for Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const today = getTodayIndonesia();
    const subject = getEmailSubject(today);

    // If companyGroups is empty, it means this is just a dummy request to trigger auto-archive
    // so we skip the actual SMTP sending
    if (companyGroups && companyGroups.length > 0) {
      // Send email
      const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      cc: cc || undefined,
      subject,
        html: htmlBody,
      };

      await transporter.sendMail(mailOptions);
    }

    // Auto-archive: mark PIs as 'budgeted' so they don't appear in Modal Anggaran
    if (piIds && piIds.length > 0) {
      await prisma.purchaseInvoice.updateMany({
        where: { id: { in: piIds } },
        data: {
          budgetStatus: 'budgeted',
          budgetedAt: new Date(),
          budgetedBy: senderName || 'Finance',
        },
      });
    } else if (piList && piList.length > 0) {
      // Fallback: use piList (noPi) if piIds not provided
      await prisma.purchaseInvoice.updateMany({
        where: { noPi: { in: piList } },
        data: {
          budgetStatus: 'budgeted',
          budgetedAt: new Date(),
          budgetedBy: senderName || 'Finance',
        },
      });
    }

    // Log to Google Sheets
    const logRow = [
      new Date().toISOString(),                          // Timestamp
      'SEND_EMAIL',                                       // Action
      senderName || 'Finance',                            // User
      String(totalPI),                                    // PI Count
      piList.join(', '),                                  // PI List
      String(grandTotal),                                 // Total Nominal
      to,                                                 // Recipient
      cc || '',                                           // CC
      'success',                                          // Status
      String(invoiceFoundCount),                          // Invoice Found
      String(invoiceNotFoundCount),                       // Invoice Not Found
      '',                                                 // Error Message
    ];

    await appendToLogSheet(logRow);

    return NextResponse.json({
      success: true,
      message: 'Email berhasil dikirim',
      data: {
        to,
        cc,
        subject,
        totalPI,
        grandTotal,
        invoiceFoundCount,
        invoiceNotFoundCount,
      },
    });
  } catch (error) {
    console.error('Error sending email:', error);

    // Log failure
    try {
      const body = await req.clone().json();
      const logRow = [
        new Date().toISOString(),
        'SEND_EMAIL',
        body.senderName || 'Finance',
        String(body.totalPI || 0),
        (body.piList || []).join(', '),
        String(body.grandTotal || 0),
        body.to || '',
        body.cc || '',
        'failed',
        '0',
        '0',
        error instanceof Error ? error.message : 'Unknown error',
      ];
      await appendToLogSheet(logRow);
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    );
  }
}
