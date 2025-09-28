'use client'

import { useState, useEffect } from 'react'
import { Download, QrCode, Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'
import HomeButton from '@/components/HomeButton'

export default function QRCodePage() {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    // Get the current URL
    const currentUrl = window.location.origin
    setBaseUrl(currentUrl)
    
    // Generate QR code for the kiosk link
    const kioskUrl = `${currentUrl}/kiosk`
    
    QRCode.toDataURL(kioskUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e293b', // slate-800
        light: '#ffffff'
      }
    })
    .then(url => {
      setQrCodeDataURL(url)
      setIsLoading(false)
    })
    .catch(err => {
      console.error('Error generating QR code:', err)
      setIsLoading(false)
    })
  }, [])

  const handleDownload = () => {
    if (qrCodeDataURL) {
      const link = document.createElement('a')
      link.download = 'wellness-kiosk-qr-code.png'
      link.href = qrCodeDataURL
      link.click()
    }
  }

  const handleCopyLink = async () => {
    const kioskUrl = `${baseUrl}/kiosk`
    try {
      await navigator.clipboard.writeText(kioskUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyShortLink = async () => {
    const shortUrl = `${baseUrl}/k`
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">QR Code Generator</h1>
          <HomeButton />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <QrCode className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Wellness Kiosk QR Code</h2>
            <p className="text-gray-600">Scan this QR code to access the wellness survey kiosk mode</p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Generating QR code...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* QR Code Display */}
              <div className="text-center">
                <div className="bg-white p-6 rounded-lg border-2 border-gray-200 inline-block">
                  {qrCodeDataURL && (
                    <img 
                      src={qrCodeDataURL} 
                      alt="Wellness Kiosk QR Code" 
                      className="w-64 h-64 mx-auto"
                    />
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </button>
                </div>
              </div>

              {/* Links and Information */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Kiosk Links</h3>
                  
                  {/* Full Link */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Kiosk Link:
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={`${baseUrl}/kiosk`}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50 text-sm"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-gray-600 text-white rounded-r-lg hover:bg-gray-700 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Short Link */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Short Link:
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={`${baseUrl}/k`}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50 text-sm"
                      />
                      <button
                        onClick={handleCopyShortLink}
                        className="px-3 py-2 bg-gray-600 text-white rounded-r-lg hover:bg-gray-700 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">How to Use:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Print the QR code and place it in your facility</li>
                    <li>• Players scan the code with their phone camera</li>
                    <li>• They&apos;ll be taken directly to the kiosk mode</li>
                    <li>• No need to remember URLs or navigate menus</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Features:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Automatically finds the active survey</li>
                    <li>• Works on all mobile devices</li>
                    <li>• Fullscreen mode for better experience</li>
                    <li>• No admin access required for players</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
