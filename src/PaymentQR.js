import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode'; // Make sure to add "qrcode" to your package.json dependencies

export default function AutoBillQR({ amount, invoiceId }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !amount) return;

    const upiId = "yourmerchant@bank"; // 👈 Put your real merchant UPI ID here
    const businessName = "Your Business Name";
    const formattedAmount = parseFloat(amount).toFixed(2);
    
    // Standard NCPI deep link that works flawlessly across Phone and Desktop browsers
    const upiPayload = `upi://pay?pa=${upiId}` +
                       `&pn=${encodeURIComponent(businessName)}` +
                       `&am=${formattedAmount}` +
                       `&tr=${invoiceId}` +
                       `&tn=${encodeURIComponent(`Invoice #${invoiceId}`)}` +
                       `&cu=INR`;

    QRCode.toCanvas(canvasRef.current, upiPayload, {
      width: 250,
      margin: 2
    }, (error) => {
      if (error) console.error('QR Generation Error:', error);
    });
  }, [amount, invoiceId]);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h3>Scan to Pay</h3>
      <canvas ref={canvasRef}></canvas>
      <p>Amount: ₹{parseFloat(amount).toFixed(2)}</p>
    </div>
  );
}
export default PaymentQR; 
