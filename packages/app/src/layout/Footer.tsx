'use client';
/**
 * Footer Component
 * 
 * Footer with customizable address and contact information.
 */


import { useCustomization } from '../contexts/CustomizationContext';

export function Footer() {
  const { customization } = useCustomization();

  const formatAddress = () => {
    const parts = [
      customization.addressLine1,
      customization.addressLine2,
      customization.addressCity,
      customization.addressState,
      customization.addressZip,
      customization.addressCountry,
    ].filter(Boolean);

    return parts.join(', ');
  };

  return (
    <footer 
      className="mt-auto py-6 border-t"
      style={{ 
        backgroundColor: customization.primaryColor,
        borderColor: customization.secondaryColor 
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Company Info */}
          <div className="text-center md:text-left">
            <p 
              className="text-sm font-semibold"
              style={{ color: customization.textColor }}
            >
              {customization.companyName}
            </p>
            <p 
              className="text-xs opacity-80"
              style={{ color: customization.textColor }}
            >
              {formatAddress()}
            </p>
          </div>

          {/* Contact Info */}
          {(customization.supportEmail || customization.supportPhone) && (
            <div className="text-center md:text-right">
              {customization.supportEmail && (
                <p className="text-sm">
                  <a
                    href={`mailto:${customization.supportEmail}`}
                    className="hover:underline"
                    style={{ color: customization.textColor }}
                  >
                    {customization.supportEmail}
                  </a>
                </p>
              )}
              {customization.supportPhone && (
                <p 
                  className="text-xs opacity-80"
                  style={{ color: customization.textColor }}
                >
                  {customization.supportPhone}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Copyright */}
        <div className="mt-4 text-center">
          <p 
            className="text-xs opacity-70"
            style={{ color: customization.textColor }}
          >
            © {new Date().getFullYear()} {customization.companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
