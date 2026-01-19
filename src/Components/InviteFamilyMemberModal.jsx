import React, { useState } from 'react';
import { Link, Mail, Copy, Share2, Check, UserPlus, X } from 'lucide-react';

const InviteFamilyMemberModal = ({ onClose, familyCode }) => {
  const rawBaseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
  const baseUrl = /^https?:\/\//i.test(rawBaseUrl)
    ? rawBaseUrl
    : `https://${rawBaseUrl}`;
  const inviteLink = `${baseUrl.replace(/\/$/, '')}/register?familyCode=${familyCode}`;
  // const [isCopied, setIsCopied] = useState(false);
  // const [email, setEmail] = useState('');
  // const [emailSent, setEmailSent] = useState(false);
  // const [activeTab, setActiveTab] = useState('link');

  // Function to copy the invite link to clipboard
  // const copyToClipboard = () => {
  //   navigator.clipboard.writeText(inviteLink);
  //   setIsCopied(true);
  //   setTimeout(() => setIsCopied(false), 2000);
  // };

  // Function to simulate sending an email
  // const sendInviteByEmail = async () => {
  //   // Simulate email sending logic here
  //   setEmailSent(true);
  //   setTimeout(() => setEmailSent(false), 2000);
  // };

  // WhatsApp share logic
  const handleWhatsAppShare = () => {
    const message = ` ${inviteLink}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-primary-700">Invite New Family Member</h2>
        {/* Invite Link Box as Clickable Link */}
        <div className="mb-8 flex flex-col items-center">
          <label className="block text-gray-700 font-semibold mb-2 text-center w-full">Invitation Link</label>
          <a
            href={inviteLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block px-4 py-3 border border-primary-200 rounded-lg bg-primary-50 text-primary-800 text-center font-semibold text-base cursor-pointer select-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all mb-2 hover:bg-primary-100 hover:text-primary-900 hover:underline"
            title="Open registration link in new tab"
          >
            {inviteLink}
          </a>
        </div>
        {/* WhatsApp Share Button */}
        <div className="mb-2">
          <label className="block text-gray-700 font-semibold mb-2">Share via WhatsApp</label>
          <button
            onClick={handleWhatsAppShare}
            className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-md"
          >
            <img src="/public/assets/whatsapp.png" alt="WhatsApp" className="w-6 h-6" />
            Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteFamilyMemberModal;