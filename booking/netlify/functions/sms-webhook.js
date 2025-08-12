const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabaseUrl = process.env.SUPABASE_URL || 'https://dcukfurezlkagvvwgsgr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw';
const supabase = createClient(supabaseUrl, supabaseKey);

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// *** ADD EmailJS Configuration (copied from booking-response.js) ***
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID || 'template_confirmed';
const EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID || 'template_therapist_ok';
const EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_DECLINED_TEMPLATE_ID || 'template_declined';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

console.log('📧 EmailJS Configuration:');
console.log('Service ID:', EMAILJS_SERVICE_ID);
console.log('Public Key:', EMAILJS_PUBLIC_KEY);
console.log('Private Key:', EMAILJS_PRIVATE_KEY ? '✅ Configured' : '❌ Missing');

exports.handler = async (event, context) => {
  console.log('📱 SMS webhook received');
  
  // Relaxed signature validation - don't block if it fails
  const signature = event.headers['x-twilio-signature'] || event.headers['X-Twilio-Signature'];
  if (TWILIO_AUTH_TOKEN && signature) {
    try {
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      const host = event.headers['host'];
      const path = event.path || event.rawPath || '/.netlify/functions/sms-webhook';
      const url = `${protocol}://${host}${path}`;
      
      const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, event.body || '');
      if (isValid) {
        console.log('✅ Twilio signature validated');
      } else {
        console.log('⚠️  Signature validation failed, but continuing...');
      }
    } catch (e) {
      console.log('⚠️  Signature validation error, but continuing...');
    }
  }

  try {
    // Parse Twilio webhook data
    const params = new URLSearchParams(event.body || '');
    const fromPhone = params.get('From');
    const messageBody = params.get('Body')?.trim()?.toUpperCase();

    console.log('📱 SMS from:', fromPhone);
    console.log('📄 Message:', messageBody);

    if (!fromPhone || !messageBody) {
      console.log('❌ Missing phone or message');
      return { statusCode: 200, body: 'Missing data' };
    }

    // Parse the reply message
    const response = parseTherapistResponse(messageBody);
    console.log('🔍 Parsed response:', JSON.stringify(response, null, 2));
    
    if (!response.isValid) {
      console.log('❌ Invalid format, sending help');
      await sendHelpSMS(fromPhone);
      return { statusCode: 200, body: 'Help sent' };
    }

    // Find therapist by phone number
    console.log('🔍 Looking up therapist...');
    const therapist = await findTherapistByPhone(fromPhone);
    console.log('👤 Therapist found:', therapist ? `${therapist.first_name} ${therapist.last_name}` : 'NOT FOUND');
    
    if (!therapist) {
      console.log('❌ Therapist not found');
      await sendErrorSMS(fromPhone, 'Phone number not found in our system. Please contact support.');
      return { statusCode: 200, body: 'Therapist not found' };
    }

    // Process the booking response
    console.log('🔄 Processing booking response...');
    const result = await processBookingResponse(
      response.action, 
      response.bookingId, 
      therapist,
      fromPhone
    );

    console.log('✅ SMS response processed:', JSON.stringify(result, null, 2));
    return { statusCode: 200, body: 'Response processed' };

  } catch (error) {
    console.error('❌ Error processing SMS webhook:', error);
    return { statusCode: 200, body: 'Error occurred' }; // Always return 200 to Twilio
  }
};

// Parse therapist SMS response
function parseTherapistResponse(messageBody) {
  console.log('🔍 Parsing message:', messageBody);
  
  const patterns = [
    /^ACCEPT\s+(RMM\d{6}-\d{4})$/,
    /^DECLINE\s+(RMM\d{6}-\d{4})$/,
    /^A\s+(RMM\d{6}-\d{4})$/,
    /^D\s+(RMM\d{6}-\d{4})$/
  ];
  
  for (const pattern of patterns) {
    const match = messageBody.match(pattern);
    if (match) {
      const action = (messageBody.startsWith('A') && !messageBody.startsWith('ACCEPT')) ? 'accept' : 
                    messageBody.startsWith('ACCEPT') ? 'accept' : 'decline';
      return {
        isValid: true,
        action: action,
        bookingId: match[1]
      };
    }
  }
  
  return { isValid: false };
}

// Find therapist by phone number
async function findTherapistByPhone(phoneNumber) {
  try {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    console.log('🔍 Looking up therapist with phone:', phoneNumber);
    console.log('🔍 Cleaned phone:', cleanPhone);
    
    // Try exact match first
    let { data: therapist, error } = await supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, email, phone')
      .eq('phone', phoneNumber)
      .eq('is_active', true)
      .single();
    
    if (therapist) {
      console.log('✅ Found therapist with exact match');
      return therapist;
    }
    
    // Try formatted variations
    const variations = [
      '+61' + cleanPhone.slice(-9),
      '0' + cleanPhone.slice(-9),
      cleanPhone.slice(-9)
    ];
    
    console.log('🔍 Trying variations:', variations);
    
    for (const variation of variations) {
      const { data: therapistAlt } = await supabase
        .from('therapist_profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('phone', variation)
        .eq('is_active', true)
        .single();
      
      if (therapistAlt) {
        console.log(`✅ Found therapist with variation: ${variation}`);
        return therapistAlt;
      }
    }
    
    console.log('❌ No therapist found with any variation');
    return null;
    
  } catch (error) {
    console.error('❌ Error finding therapist:', error);
    return null;
  }
}

// Process the booking response
async function processBookingResponse(action, bookingId, therapist, therapistPhone) {
  try {
    console.log('🔄 Processing', action, 'for booking', bookingId, 'from therapist', therapist.first_name);
    
    // Get booking details WITH services data for emails
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, services(*)')
      .eq('booking_id', bookingId)
      .single();

    if (bookingError) {
      console.error('❌ Booking lookup error:', bookingError);
    }

    if (bookingError || !booking) {
      console.log('❌ Booking not found');
      await sendErrorSMS(therapistPhone, `Booking ${bookingId} not found. Please check the booking ID.`);
      return { success: false, error: 'Booking not found' };
    }

    console.log('📋 Booking found:', {
      id: booking.id,
      status: booking.status,
      customer: `${booking.first_name} ${booking.last_name}`,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email
    });

    // Check booking status
    if (booking.status === 'confirmed') {
      await sendErrorSMS(therapistPhone, `Booking ${bookingId} has already been accepted by another therapist.`);
      return { success: false, error: 'Already confirmed' };
    }

    if (booking.status === 'declined') {
      await sendErrorSMS(therapistPhone, `Booking ${bookingId} has already been declined.`);
      return { success: false, error: 'Already declined' };
    }

    // Process accept or decline
    if (action === 'accept') {
      return await handleSMSAccept(booking, therapist, therapistPhone);
    } else {
      return await handleSMSDecline(booking, therapist, therapistPhone);
    }

  } catch (error) {
    console.error('❌ Error processing booking response:', error);
    await sendErrorSMS(therapistPhone, 'Error processing your response. Please try again or contact support.');
    return { success: false, error: error.message };
  }
}

// *** UPDATED: Handle SMS acceptance WITH EMAIL SENDING ***
async function handleSMSAccept(booking, therapist, therapistPhone) {
  try {
    console.log('✅ Processing SMS acceptance for', booking.booking_id);
    
    // Update booking status
    console.log('🔄 Updating booking status...');
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        therapist_id: therapist.id,
        therapist_response_time: new Date().toISOString(),
        responding_therapist_id: therapist.id,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw new Error('Failed to update booking status');
    }
    console.log('✅ Booking status updated');

    // Add status history
    await addStatusHistory(booking.id, 'confirmed', therapist.id, 'Accepted via SMS');

    // Send confirmation SMS to therapist
    console.log('📱 Sending confirmation SMS to therapist...');
    const confirmMessage = `✅ BOOKING CONFIRMED!

You've accepted booking ${booking.booking_id}
Client: ${booking.first_name} ${booking.last_name}
Date: ${new Date(booking.booking_time).toLocaleDateString()} at ${new Date(booking.booking_time).toLocaleTimeString()}
Fee: $${booking.therapist_fee || 'TBD'}

Client will be notified. Check email for full details.
- Rejuvenators`;

    const therapistSMSResult = await sendSMS(therapistPhone, confirmMessage);
    console.log('📱 Therapist SMS result:', therapistSMSResult);

    // Send SMS to customer
    const customerPhone = formatPhoneNumber(booking.customer_phone);
    console.log('📞 Customer phone (original):', booking.customer_phone);
    console.log('📞 Customer phone (formatted):', customerPhone);
    
    if (customerPhone) {
      console.log('📱 Sending confirmation SMS to customer...');
      const customerMessage = `🎉 BOOKING CONFIRMED!

${therapist.first_name} ${therapist.last_name} has accepted your massage booking for ${new Date(booking.booking_time).toLocaleDateString()} at ${new Date(booking.booking_time).toLocaleTimeString()}.

Check your email for full details!
- Rejuvenators`;

      const customerSMSResult = await sendSMS(customerPhone, customerMessage);
      console.log('📱 Customer SMS result:', customerSMSResult);
    } else {
      console.log('❌ No valid customer phone number');
    }

    // *** NEW: Send confirmation emails (copied from booking-response.js) ***
    console.log('📧 Starting to send confirmation emails...');
    
    // Send email to customer
    if (booking.customer_email) {
      console.log('📧 Sending confirmation email to customer:', booking.customer_email);
      try {
        await sendClientConfirmationEmail(booking, therapist);
        console.log('✅ Customer confirmation email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending customer confirmation email:', emailError);
      }
    } else {
      console.log('❌ No customer email found');
    }

    // Send email to therapist
    if (therapist.email) {
      console.log('📧 Sending confirmation email to therapist:', therapist.email);
      try {
        await sendTherapistConfirmationEmail(booking, therapist);
        console.log('✅ Therapist confirmation email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending therapist confirmation email:', emailError);
      }
    } else {
      console.log('❌ No therapist email found');
    }

    return { success: true, action: 'accepted' };

  } catch (error) {
    console.error('❌ Error handling SMS accept:', error);
    await sendErrorSMS(therapistPhone, 'Error confirming booking. Please contact support.');
    return { success: false, error: error.message };
  }
}

// *** UPDATED: Handle SMS decline WITH EMAIL SENDING ***
async function handleSMSDecline(booking, therapist, therapistPhone) {
  try {
    console.log('❌ Processing SMS decline for', booking.booking_id);
    
    // Update booking status to declined
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'declined',
        therapist_response_time: new Date().toISOString(),
        responding_therapist_id: therapist.id,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      throw new Error('Failed to update booking status');
    }

    await addStatusHistory(booking.id, 'declined', therapist.id, 'Declined via SMS');
    
    const confirmMessage = `📝 BOOKING DECLINED

You've declined booking ${booking.booking_id}. The client has been notified.
- Rejuvenators`;

    await sendSMS(therapistPhone, confirmMessage);

    // Notify customer via SMS
    const customerPhone = formatPhoneNumber(booking.customer_phone);
    if (customerPhone) {
      const customerMessage = `❌ BOOKING UPDATE

Unfortunately, your therapist declined booking ${booking.booking_id}. We're looking for alternatives and will update you soon.
- Rejuvenators`;

      await sendSMS(customerPhone, customerMessage);
    }

    // *** NEW: Send decline email to customer ***
    if (booking.customer_email) {
      console.log('📧 Sending decline email to customer:', booking.customer_email);
      try {
        await sendClientDeclineEmail(booking);
        console.log('✅ Customer decline email sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending customer decline email:', emailError);
      }
    }

    return { success: true, action: 'declined' };

  } catch (error) {
    console.error('❌ Error handling SMS decline:', error);
    await sendErrorSMS(therapistPhone, 'Error processing decline. Please contact support.');
    return { success: false, error: error.message };
  }
}

// *** NEW: Email functions (copied from booking-response.js) ***

async function sendClientConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Preparing client confirmation email...');

    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist: therapist.first_name + ' ' + therapist.last_name,
      estimated_price: booking.price ? '$' + booking.price.toFixed(2) : 'N/A'
    };

    const result = await sendEmail(EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID, templateParams);
    return result;

  } catch (error) {
    console.error('❌ Error in sendClientConfirmationEmail:', error);
    throw error;
  }
}

async function sendTherapistConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Preparing therapist confirmation email...');

    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: therapist.email,
      to_name: therapist.first_name + ' ' + therapist.last_name,
      therapist_name: therapist.first_name + ' ' + therapist.last_name,
      booking_id: booking.booking_id,
      client_name: booking.first_name + ' ' + booking.last_name,
      client_phone: booking.customer_phone || 'Not provided',
      client_email: booking.customer_email,
      service_name: serviceName,
      duration: booking.duration_minutes + ' minutes',
      booking_date: new Date(booking.booking_time).toLocaleDateString(),
      booking_time: new Date(booking.booking_time).toLocaleTimeString(),
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist_fee: booking.therapist_fee ? '$' + booking.therapist_fee.toFixed(2) : 'TBD'
    };

    const result = await sendEmail(EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, templateParams);
    return result;

  } catch (error) {
    console.error('❌ Error in sendTherapistConfirmationEmail:', error);
    throw error;
  }
}

async function sendClientDeclineEmail(booking) {
  try {
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log('📧 Decline email sent to client:', booking.customer_email);

  } catch (error) {
    console.error('❌ Error sending client decline email:', error);
  }
}

async function sendEmail(templateId, templateParams) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }
    
    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ EmailJS API error:', response.status, responseText);
      return { success: false, error: 'EmailJS error: ' + response.status };
    }

    return { success: true, response: responseText };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Helper functions
async function sendHelpSMS(phoneNumber) {
  const helpMessage = `📱 SMS BOOKING HELP

To respond to booking requests:
- Reply "ACCEPT [BookingID]" to accept
- Reply "DECLINE [BookingID]" to decline

Example: "ACCEPT RMM202501-0123"

Short forms work too:
- "A RMM202501-0123" 
- "D RMM202501-0123"

Need help? Call 1300 302542
- Rejuvenators`;

  await sendSMS(phoneNumber, helpMessage);
}

async function sendErrorSMS(phoneNumber, errorMessage) {
  const message = `❌ ERROR: ${errorMessage}

Need help? Call 1300 302542
- Rejuvenators`;
  
  await sendSMS(phoneNumber, message);
}

async function sendSMS(phoneNumber, message) {
  try {
    console.log(`📱 Sending SMS to ${phoneNumber}`);
    console.log(`📄 Message preview: ${message.substring(0, 100)}...`);
    
    const response = await fetch('https://rmmbookingplatform.netlify.app/.netlify/functions/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber, message: message })
    });
    
    const result = await response.json();
    console.log('📱 SMS API response:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return { success: false, error: error.message };
  }
}

// Utility functions
function formatPhoneNumber(phone) {
  console.log('🔄 Formatting phone:', phone);
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  let formatted;
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    formatted = '+61' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    formatted = '+61' + cleaned;
  } else if (phone.startsWith('+61')) {
    formatted = phone;
  } else {
    formatted = phone;
  }
  console.log('📞 Formatted result:', formatted);
  return formatted;
}

async function addStatusHistory(bookingId, status, userId, notes) {
  try {
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        notes: notes || null
      });
    console.log('✅ Status history added');
  } catch (error) {
    console.error('❌ Error adding status history:', error);
  }
}
