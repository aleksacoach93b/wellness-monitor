/** Resize/compress club logos before storing as data URL (keeps DB payloads reasonable). */
export function compressClubLogo(file: File, maxEdge = 320, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not available'))
          return
        }
        // White canvas so transparent PNGs don't become black after JPEG encode
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        // Always JPEG — much smaller than PNG for DB/API body limits
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}
