'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface BodyMapProps {
  view: 'front' | 'back'
  onAreaClick: (areaId: string, rating: number) => void
  selectedAreas: Record<string, number>
  onViewChange: (view: 'front' | 'back') => void
  onContinue: () => void
  onClose: () => void
}

export default function BodyMap({ view, onAreaClick, selectedAreas, onViewChange, onContinue, onClose }: BodyMapProps) {
  const [scale, setScale] = useState(0.8)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastTouchDistance, setLastTouchDistance] = useState(0)

  // Handle zoom and pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(Math.max(scale * delta, 0.5), 3)
    setScale(newScale)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      const distance = Math.sqrt(
        Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
        Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
      )
      setLastTouchDistance(distance)
    } else if (e.touches.length === 1) {
      // Single touch - start drag
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 2) {
      // Pinch to zoom
      const distance = Math.sqrt(
        Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
        Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
      )
      
      if (lastTouchDistance > 0) {
        const scaleChange = distance / lastTouchDistance
        const newScale = Math.min(Math.max(scale * scaleChange, 0.5), 3)
        setScale(newScale)
      }
      setLastTouchDistance(distance)
    } else if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setLastTouchDistance(0)
  }

  const resetZoom = () => {
    setScale(0.8)
    setPosition({ x: 0, y: 0 })
  }

  const getColorForRating = (rating: number): string => {
    if (rating >= 1 && rating <= 3) return '#10b981' // green
    if (rating >= 4 && rating <= 6) return '#f59e0b' // yellow
    if (rating >= 7 && rating <= 8) return '#f97316' // orange
    if (rating >= 9 && rating <= 10) return '#ef4444' // red
    return '#6b7280' // gray
  }

  // Prevent auto-scroll to top when body map opens
  useEffect(() => {
    // Disable any auto-scroll behavior
    const handleScroll = () => {
      // Allow normal scrolling but prevent auto-scroll to top
    }
    
    document.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      document.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleAreaClick = (areaId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    // Get current rating for this area (0 if not selected)
    const currentRating = selectedAreas[areaId] || 0
    
    // Cycle through ratings: 0 -> 1 -> 2 -> ... -> 10 -> 0
    const nextRating = currentRating >= 10 ? 0 : currentRating + 1
    
    // Call onAreaClick with the new rating
    onAreaClick(areaId, nextRating)
  }


  const handleDeselectArea = (areaId: string) => {
    // Remove the area from selectedAreas
    const newSelectedAreas = { ...selectedAreas }
    delete newSelectedAreas[areaId]
    // Call onAreaClick with rating 0 to indicate deselection
    onAreaClick(areaId, 0)
  }

  const getMuscleName = (areaId: string): string => {
    const muscleNames: Record<string, string> = {
      // Front body paths
      'path-4': 'Face and Skin',
      'path-5': 'Top Head',
      'path-7': 'Right Pectoralis Major',
      'path-8': 'Right Intercostal',
      'path-9': 'Right Intercostal',
      'path-10': 'Right Intercostal',
      'path-11': 'Right Oblique',
      'path-12': 'Right Oblique',
      'path-13': 'Right Upper Rectus Abdominis',
      'path-14': 'Right Middle Rectus Abdominis',
      'path-15': 'Right Lower Rectus Abdominis',
      'path-16': 'Right Pubic Area',
      'path-17': 'Right Oblique',
      'path-18': 'Right Oblique',
      'path-19': 'Right Oblique',
      'path-20': 'Right Sternocleidomastoideus',
      'path-21': 'Right Trap Front',
      'path-22': 'Right Trapezius',
      'path-23': 'Right Deltoideus',
      'path-24': 'Right Biceps Brachii SH',
      'path-25': 'Right Biceps Brachii LH',
      'path-26': 'Right Forearm Lateral',
      'path-27': 'Right Forearm Central',
      'path-28': 'Right Forearm Medial',
      'path-29': 'Right Patella',
      'path-30': 'Right Medial Knee',
      'path-31': 'Right Calf Front',
      'path-32': 'Right Tibialis Anterior',
      'path-33': 'Right Digitorum Longus',
      'path-34': 'Right Ankle',
      'path-35': 'Right Ankle Ligaments',
      'path-36': 'Right Foot Front',
      'path-37': 'Right Feet Toe',
      'path-38': 'Right Hand Front',
      'path-39': 'Right 5th Finger',
      'path-40': 'Right 4th Finger',
      'path-41': 'Right 3rd Finger',
      'path-42': 'Right 2nd Finger',
      'path-43': 'Right 1st Finger',
      'path-44': 'Right Larynx',
      'path-45': 'Right Pubis Adductor',
      'path-46': 'Right Adductor Long',
      'path-47': 'Right Rectus Femoris',
      'path-48': 'Right Vastus Lateralis',
      'path-49': 'Right Vastus Medialis',
      'path-50': 'Right Adductor Short',
      'path-51': 'Left Pectoralis Major',
      'path-52': 'Left Intercostal',
      'path-53': 'Left Intercostal',
      'path-54': 'Left Intercostal',
      'path-55': 'Left Oblique',
      'path-56': 'Left Oblique',
      'path-57': 'Left Upper Rectus Abdominis',
      'path-58': 'Left Middle Rectus Abdominis',
      'path-59': 'Left Lower Rectus Abdominis',
      'path-60': 'Left Pubic Area',
      'path-61': 'Left Oblique',
      'path-62': 'Left Oblique',
      'path-63': 'Left Oblique',
      'path-64': 'Left Sternocleidomastoideus',
      'path-65': 'Left Trap Front',
      'path-66': 'Left Trapezius',
      'path-67': 'Left Deltoideus',
      'path-68': 'Left Biceps Brachii SH',
      'path-69': 'Left Biceps Brachii LH',
      'path-70': 'Left Forearm Lateral',
      'path-71': 'Right Forearm Central',
      'path-72': 'Left Forearm Medial',
      'path-73': 'Left Patella',
      'path-74': 'Left Medial Knee',
      'path-75': 'Left Calf Front',
      'path-76': 'Left Tibialis Anterior',
      'path-77': 'Left Digitorum Longus',
      'path-78': 'Left Ankle',
      'path-79': 'Left Ankle Ligaments',
      'path-80': 'Left Foot Front',
      'path-81': 'Left Feet Toe',
      'path-82': 'Left Hand Front',
      'path-83': 'Left 5th Finger',
      'path-84': 'Left 4th Finger',
      'path-85': 'Left 3rd Finger',
      'path-86': 'Left 2nd Finger',
      'path-87': 'Left 1st Finger',
      'path-88': 'Left Larynx',
      'path-89': 'Left Pubis Adductor',
      'path-90': 'Left Adductor Long',
      'path-91': 'Left Rectus Femoris',
      'path-92': 'Left Vastus Lateralis',
      'path-93': 'Left Vastus Medialis',
      'path-94': 'Left Adductor Short',
      
      // Back body paths
      'back-head': 'Back Head',
      'left-foot': 'Left Foot',
      'left-gluteus-maximus': 'Left Gluteus Maximus',
      'left-back-trap': 'Left Back Trap',
      'left-infraspinatus': 'Left Infraspinatus',
      'left-back-shoulder': 'Left Back Shoulder',
      'left-teres-major': 'Left Teres Major',
      'left-triceps': 'Left Triceps',
      'left-latisimus-dorsi': 'Left Latisimus Dorsi',
      'left-back-hip': 'Left Back Hip',
      'left-adductor-back': 'Left Adductor Back',
      'left-vastus-lateralis-quad': 'Left Vastus Lateralis Quad',
      'left-bflh': 'Left BFlh',
      'left-semimembranosus': 'Left Semimembranosus',
      'left-lateral-gastrocs': 'Left Lateral Gastrocs',
      'left-medial-gastrocs': 'Left Medial Gastrocs',
      'left-heel': 'Left Heel',
      'left-achilles': 'Left Achilles',
      'left-semitendinosus': 'Left Semitendinosus',
      'left-elbow': 'Left Elbow',
      'left-back-forearm': 'Left Back Forearm',
      'left-gluteus-medius': 'Left Gluteus Medius',
      'left-lower-back': 'Left Lower Back',
      'left-back-upper-trap': 'Left Back Upper Trap',
      'left-back-hand': 'Left Back Hand',
      'left-back-5th-finger': 'Left Back 5th Finger',
      'left-back-4th-finger': 'Left Back 4th Finger',
      'left-back-3rd-finger': 'Left Back 3rd Finger',
      'left-back-2nd-finger': 'Left Back 2nd Finger',
      'left-back-1st-finger': 'Left Back 1st Finger',
      'right-foot': 'Right Foot',
      'right-gluteus-maximus': 'Right Gluteus Maximus',
      'right-back-trap': 'Right Back Trap',
      'right-infraspinatus': 'Right Infraspinatus',
      'right-back-shoulder': 'Right Back Shoulder',
      'right-teres-major': 'Right Teres Major',
      'right-triceps': 'Right Triceps',
      'right-lattisimus-dorsi': 'Right Lattisimus Dorsi',
      'right-back-hip': 'Right Back Hip',
      'right-adductor-back': 'Right Adductor Back',
      'right-vastus-lateralis-quad': 'Right Vastus Lateralis Quad',
      'right-bflh': 'Right BFlh',
      'right-semimembranosus': 'Right Semimembranosus',
      'right-lateral-gastrocs': 'Right Lateral Gastrocs',
      'right-medial-gastrocs': 'Right Medial Gastrocs',
      'right-heel': 'Right Heel',
      'right-achilles': 'Right Achilles',
      'right-semitendinosus': 'Right Semitendinosus',
      'right-elbow': 'Right Elbow',
      'right-back-forearm': 'Right Back Forearm',
      'right-gluteus-medius': 'Right Gluteus Medius',
      'right-lower-back': 'Right Lower Back',
      'right-back-upper-trap': 'Right Back Upper Trap',
      'right-back-hand': 'Right Back Hand',
      'right-back-5th-finger': 'Right Back 5th Finger',
      'right-back-4th-finger': 'Right Back 4th Finger',
      'right-back-3rd-finger': 'Right Back 3rd Finger',
      'right-back-2nd-finger': 'Right Back 2nd Finger',
      'right-back-1st-finger': 'Right Back 1st Finger'
    };
    return muscleNames[areaId] || areaId.replace(/-/g, ' ');
  }

  const getAreaColor = (areaId: string) => {
    const rating = selectedAreas[areaId]
    if (!rating) return '#e5e7eb' // Default gray
    
    // Color based on rating intensity
    if (rating <= 3) return '#22c55e' // Green for mild pain (1-3)
    if (rating <= 6) return '#eab308' // Yellow for moderate pain (4-6)
    if (rating <= 8) return '#f97316' // Orange for high pain (7-8)
    return '#ef4444' // Red for severe pain (9-10)
  }

  const frontBodySVG = (
    <svg 
      width="400" 
      height="600" 
      viewBox="0 0 595.276 841.89" 
      xmlns="http://www.w3.org/2000/svg"
      className="max-w-full h-auto"
    >
      <defs>
        <style>
          {`
            .body-area { cursor: pointer; transition: opacity 0.2s; }
            .body-area:hover { opacity: 0.7; }
            .cls-1 { fill: #707070; }
            .cls-2 { fill: #bebdbe; }
            .cls-3 { fill: #3f3f3f; }
          `}
        </style>
      </defs>
      
      {/* Front Body - Individual Muscle Regions */}
      <g>
        <g id="G_1">
          <g id="Sloy_1">
            <g id="Posterior_Body">
            {/* Face and Skin - NON-CLICKABLE */}
            <path 
              id="path-4"
              className="body-area"
              fill={getAreaColor('path-4')}
              stroke="#374151" 
              strokeWidth="1"
              style={{ pointerEvents: 'none' }}
              d="M502.271,431.319c-1.152-1.209-7.315-5.184-8.812-6.739-1.497-1.555-1.497-2.765-5.644-9.906-4.147-7.142-19.611-13.477-21.339-13.823-1.728-.346-5.097-4.579-5.961-6.911-3.562-9.619-11.922-42.505-15.551-71.879-3.628-29.373-17.278-45.961-24.708-56.155.346-28.164-6.114-34.031-9.676-43.024.346-7.084,2.805-22.479,1.144-42.717-1.316-16.03-21.359-35.152-33.8-36.88-8.056-1.119-12.498.806-22.923,0-10.425-.806-29.949-18.315-30.986-20.389-1.037-2.073-3.225-19.352-1.613-21.541,1.613-2.189,1.843-.115,3.456-4.608,1.613-4.492.743-12.57.743-12.57,0,0,.428-1.723.725-.533.173.691.518,1.411,1.296,1.814,1.207.626,2.708-2.284,4.291-5.04,4.209-7.328,8.151-21.309,2.333-23.067-1.059-.32-2.592,2.419-2.592,2.419,0-1.382,1.382-14.168-.691-22.117-1.661-6.366-7.878-12.731-12.786-16.587-5.995-4.711-18.223-5.043-21.268-5.066v-.002c-.063,0-.175,0-.271,0-.096,0-.208,0-.271,0v.002c-3.045.023-15.273.355-21.268,5.066-4.908,3.856-11.125,10.221-12.786,16.587-2.073,7.948-.691,20.734-.691,22.117,0,0-1.533-2.739-2.592-2.419-5.818,1.758-1.876,15.739,2.333,23.067,1.583,2.755,3.084,5.665,4.291,5.04.777-.403,1.123-1.123,1.296-1.814.298-1.19.725.533.725.533,0,0-.869,8.077.743,12.57,1.613,4.493,1.843,2.419,3.456,4.608,1.613,2.189-.576,19.467-1.613,21.541-1.037,2.073-20.561,19.582-30.986,20.389-10.425.806-14.866-1.119-22.923,0-12.441,1.728-32.484,20.849-33.8,36.88-1.662,20.238.798,35.632,1.144,42.717-3.562,8.993-10.022,14.86-9.676,43.024-7.43,10.194-21.08,26.782-24.708,56.155-3.628,29.373-11.988,62.26-15.551,71.879-.864,2.333-4.233,6.566-5.961,6.911-1.728.346-17.192,6.681-21.339,13.823-4.147,7.142-4.147,8.351-5.644,9.906-1.497,1.555-7.66,5.529-8.812,6.739-1.152,1.21-1.958,5.76,1.267,6.508,3.225.749,11.85-1.123,14.658-7.43,3.369-2.203,4.19-2.246,4.19-2.246,0,0,1.138,3.456.965,6.22-.173,2.765-5.846,11.231-8.092,16.242-2.246,5.011-8.985,14.255-7.171,16.847,1.814,2.592,4.406,2.16,5.529,1.296,1.123-.864,7.516-11.706,8.769-13.607,1.425-1.857,6.782-8.769,7.732-9.806-1.526,6.307-4.003,13.737-4.982,16.674-.979,2.937-5.545,11.78-5.587,14.802-.058,4.204,2.845,5.136,4.78,3.859,5.414-3.571,8.453-12.72,9.791-15.378,2.264-4.499,4.723-12.498,7.027-16.184-.576,4.492-1.982,10.684-2.736,15.925-.381,2.651-2.706,16.297.259,17.192,4.579,1.382,5.183-3.888,6.998-10.108s4.06-21.598,5.443-23.931c2.074.432,1.762,1.897,2.16,6.047.522,5.451.086,19.006,4.06,19.006s4.262-13.65,4.78-21.944c.518-8.294,3.225-12.671,4.608-19.467,1.382-6.796,4.602-16.238,4.377-24.19-.104-3.692-1.67-6.969,1.498-18.776,1.944-7.244,26.378-55.061,29.126-59.553,2.976-4.865,8.541-19.352,9.923-30.41,1.382-11.058,1.152-11.519,1.843-16.818.691-5.299,2.834-7.634,5.529-10.828,3.11-3.686,7.603-14.629,11.058-29.546,1.613-.058,2.106-1.39,2.88-.864,0,0,2.073,23.614,6.335,30.18,4.262,6.566,2.995,8.985,3.916,11.404.922,2.419.461,18.2-.23,26.954-.691,8.754-2.707,39.28-4.608,46.537-1.901,7.257-4.262,10.367-6.105,19.582-1.843,9.215-4.781,21.278-5.414,32.599,0,0-3.872,26.866-3.513,36.976.384,10.832-2.419,84.492,13.132,102.462-.749,3.513-.058,9.618.058,11.461.115,1.843-4.377,20.965-2.649,33.751,1.728,12.786,1.037,8.351.691,11.548-.346,3.197-14.168,46.047,6.566,124.953,1.239,4.715,1.728,14.226,1.728,19.237s-1.728,14.86-1.728,19.525-.173,6.911.864,9.849c1.037,2.937.864,7.775.173,11.404-.691,3.628-14.687,13.477-15.896,18.834-1.209,5.356-2.764,8.466-.518,10.021,2.246,1.555,3.283,0,3.283,0,0,0-.864,2.592.518,3.974,1.382,1.382,5.529,1.21,5.529,1.21,0,0,1.382.346,2.246,1.728.864,1.382,4.492,2.073,5.356,1.21.864-.864,1.382-.793,2.073.381.374.635,1.91,1.381,3.242,1.933,1.28.53,2.734.415,3.915-.311l2.692-1.657s2.246,2.592,2.765,2.765c.518.173,5.875,2.073,7.257,0,1.382-2.073,7.948-7.084,7.603-12.959-.346-5.875-.864-9.158-.691-11.231.173-2.073.691-5.184,1.555-8.294.864-3.11,1.901-4.492,1.21-10.367-.691-5.875-.173-6.22-.173-7.257s.864-3.801,1.037-6.911c.173-3.11-2.246-9.503-2.246-9.503,0,0-1.037-6.22-1.555-14.687-.518-8.466,1.21-41.814,4.665-52.872,3.456-11.058,5.483-14.52,5.875-17.278,4.147-29.201-2.588-60.642-3.801-71.763-.691-6.335,2.073-7.027,3.801-13.42,1.728-6.393,3.11-22.289,1.209-29.373-1.395-5.198,4.838-24.19,5.702-30.065.864-5.875,12.729-51.317,13.362-59.438.634-8.121,1.44-33.309-.691-37.11,1.014,0,3.922,2.018,5.161,2.37.054.046.144.055.251.047.107.008.197,0,.251-.047,1.239-.351,4.147-2.37,5.161-2.37-2.131,3.801-1.325,28.99-.691,37.11.634,8.121,12.498,53.563,13.362,59.438.864,5.875,7.096,24.867,5.702,30.065-1.901,7.084-.518,22.981,1.209,29.373,1.728,6.393,4.492,7.084,3.801,13.42-1.213,11.122-7.948,42.563-3.801,71.763.392,2.758,2.419,6.22,5.875,17.278,3.456,11.058,5.184,44.406,4.665,52.872-.518,8.467-1.555,14.687-1.555,14.687,0,0-2.419,6.393-2.246,9.503.173,3.11,1.037,5.875,1.037,6.911s.518,1.382-.173,7.257c-.691,5.875.346,7.257,1.21,10.367.864,3.11,1.382,6.22,1.555,8.294.173,2.073-.346,5.356-.691,11.231-.346,5.875,6.22,10.885,7.602,12.959,1.382,2.073,6.739.173,7.257,0,.518-.173,2.765-2.765,2.765-2.765l2.692,1.657c1.18.726,2.634.842,3.915.311,1.332-.552,2.868-1.298,3.242-1.933.691-1.174,1.21-1.245,2.073-.381.864.864,4.492.173,5.356-1.21.864-1.382,2.246-1.728,2.246-1.728,0,0,4.147.173,5.529-1.21,1.382-1.382.518-3.974.518-3.974,0,0,1.037,1.555,3.283,0,2.246-1.555.691-4.665-.518-10.021-1.209-5.356-15.205-15.205-15.896-18.834-.691-3.629-.864-8.467.173-11.404,1.037-2.937.864-5.184.864-9.849s-1.728-14.514-1.728-19.525.489-14.522,1.728-19.237c20.734-78.905,6.911-121.756,6.566-124.953-.346-3.196-1.037,1.238.691-11.548,1.728-12.786-2.765-31.908-2.649-33.751.115-1.843.806-7.948.058-11.461,15.551-17.97,12.748-91.63,13.132-102.462.359-10.11-3.513-36.976-3.513-36.976-.633-11.321-3.571-23.384-5.414-32.599-1.843-9.215-4.205-12.325-6.105-19.582-1.901-7.257-3.917-37.782-4.608-46.537-.691-8.754-1.152-24.535-.23-26.954.922-2.419-.345-4.838,3.916-11.404,4.262-6.566,6.335-30.18,6.335-30.18.774-.526,1.267.806,2.88.864,3.456,14.917,7.948,25.86,11.058,29.546,2.695,3.194,4.838,5.529,5.529,10.828.691,5.299.461,5.76,1.843,16.818,1.382,11.058,6.947,25.545,9.923,30.41,2.748,4.492,27.183,52.309,29.126,59.553,3.168,11.807,1.602,15.083,1.498,18.776-.224,7.953,2.995,17.394,4.377,24.19,1.382,6.796,4.089,11.174,4.608,19.467.518,8.294.806,21.944,4.78,21.944s3.538-13.555,4.06-19.006c.398-4.151.086-5.616,2.16-6.047,1.382,2.333,3.629,17.71,5.443,23.931,1.814,6.22,2.419,11.49,6.998,10.108,2.965-.895.641-14.541.259-17.192-.754-5.241-2.16-11.433-2.736-15.925,2.304,3.686,4.762,11.685,7.027,16.184,1.338,2.658,4.377,11.807,9.791,15.378,1.936,1.277,4.838.346,4.78-3.859-.041-3.022-4.608-11.865-5.587-14.802-.979-2.937-3.456-10.367-4.982-16.674.95,1.037,6.307,7.948,7.732,9.806,1.253,1.901,7.646,12.743,8.769,13.607,1.123.864,3.715,1.296,5.529-1.296,1.814-2.592-4.924-11.836-7.171-16.847-2.246-5.011-7.919-13.477-8.092-16.242-.173-2.765.965-6.22.965-6.22,0,0,.821.043,4.19,2.246,2.808,6.307,11.433,8.179,14.658,7.43,3.225-.749,2.419-5.299,1.267-6.508Z"
              data-title="Face and Skin"
            />

            {/* Top Head */}
            <path 
              id="path-5"
              className="body-area"
              fill={getAreaColor('path-5')}
              stroke="#374151" 
              strokeWidth="1"
              d="M320.529,16.001c-7.351-2.642-14.266-5.032-22.925-4.296-8.659-.736-15.575,1.654-22.925,4.296-11.433,4.109-14.848,19.447-14.61,30.513,0,4.569,1.186,9.11,2.194,13.533,1.033,4.533,1.604,8.979,2.11,13.604.038.343.096.726.372.934.658.497,1.413-.52,1.556-1.332.65-3.691.796-7.302.792-11.111-.017-16.624,5.167-8.1,6.035-23.742.222-4.01,2.104-6.757,6.539-6.545,6.116.293,11.95-.341,17.937-1.442,5.987,1.101,11.822,1.735,17.937,1.442,4.435-.212,6.317,2.535,6.539,6.545.868,15.642,6.051,7.118,6.035,23.742-.004,3.809.142,7.42.792,11.111.143.812.898,1.829,1.556,1.332.275-.208.334-.591.372-.934.505-4.625,1.076-9.071,2.11-13.604,1.009-4.424,2.194-8.964,2.194-13.533.238-11.066-3.177-26.405-14.61-30.513Z"
              data-title="Top Head"
              onClick={(e) => handleAreaClick('path-5', e)}
            />

            {/* Right Pectoralis Major */}
            <path 
              id="path-7"
              className="body-area"
              fill={getAreaColor('path-7')}
              stroke="#374151" 
              strokeWidth="1"
              d="M226.763,187.139c-1.11,14.865,2.785,32.845,14.754,39.98,4.395,2.62,9.492,3.764,14.508,4.776,15.745,3.176,34.78-4.665,36.319-19.053,1.646-15.393,3.99-33.818-2.921-47.295-4.597-8.965-9.04-8.985-14.051-9.503s-20.506-1.037-26.554,1.728c-7.862,3.594-17.123,8.812-19.884,17.508-1.098,3.458-1.847,7.526-2.17,11.86Z"
              data-title="Right Pectoralis Major"
              onClick={(e) => handleAreaClick('path-7', e)}
            />

            {/* Right Intercostal */}
            <path 
              id="path-8"
              className="body-area"
              fill={getAreaColor('path-8')}
              stroke="#374151" 
              strokeWidth="1"
              d="M231.597,221.529c4.838,5.702,12.039,9.693,16.184,11.814,2.092,1.071,2.304,5.119.576,5.637s-15.896-4.536-17.624-7.711-2.246-7.84-1.901-9.74c.346-1.901,2.765,0,2.765,0Z"
              data-title="Right Intercostal"
              onClick={(e) => handleAreaClick('path-8', e)}
            />

            {/* Right Intercostal */}
            <path 
              id="path-9"
              className="body-area"
              fill={getAreaColor('path-9')}
              stroke="#374151" 
              strokeWidth="1"
              d="M226.771,234.913c-.065.384-.057.769.044,1.145,1.608,5.964,7.282,15.951,9.563,17.091,1.382.691,7.775-6.22,8.639-6.739.864-.518,2.765-3.11,2.765-3.11,0,0-13.733-4.963-16.343-7.343-.924-.843-3.918-5.5-3.918-5.5l-.75,4.456Z"
              data-title="Right Intercostal"
              onClick={(e) => handleAreaClick('path-9', e)}
            />

            {/* Right Intercostal */}
            <path 
              id="path-10"
              className="body-area"
              fill={getAreaColor('path-10')}
              stroke="#374151" 
              strokeWidth="1"
              d="M227.738,245.892s-1.21,9.158,2.073,16.069,4.665,7.775,4.665,7.775c0,0,4.147-11.058,2.419-12.786s-9.158-11.058-9.158-11.058Z"
              data-title="Right Intercostal"
              onClick={(e) => handleAreaClick('path-10', e)}
            />

            {/* Right Oblique */}
            <path 
              id="path-11"
              className="body-area"
              fill={getAreaColor('path-11')}
              stroke="#374151" 
              strokeWidth="1"
              d="M237.114,290.557c2.189,3.34,16.687,14.255,18.184,16.098,1.497,1.843-.014,13.103.49,17.509-5.76-1.382-17.991-11.461-18.798-15.378-.806-3.917.124-18.229.124-18.229Z"
              data-title="Right Oblique"
              onClick={(e) => handleAreaClick('path-11', e)}
            />

            {/* Right Oblique */}
            <path 
              id="path-12"
              className="body-area"
              fill={getAreaColor('path-12')}
              stroke="#374151" 
              strokeWidth="1"
              d="M236.378,272.52c.806.864,13.564,11.577,18.893,14.085,2.283,1.075.516,17.707.516,17.707,0,0-15.762-12.705-18.14-16.506-2.378-3.801-1.471-6.247-1.701-7.859-.23-1.613.432-7.427.432-7.427Z"
              data-title="Right Oblique"
              onClick={(e) => handleAreaClick('path-12', e)}
            />

            {/* Right Upper Rectus Abdominis */}
            <path 
              id="path-13"
              className="body-area"
              fill={getAreaColor('path-13')}
              stroke="#374151" 
              strokeWidth="1"
              d="M263.159,240.363c-3.086,2.094-3.11,8.121-3.628,10.54-.518,2.419,1.209,13.304,1.209,13.304,0,0,1.728,8.639,2.419,9.676.865,1.293,23.573-13.398,25.758-14.752,1.84-1.14,4.222-1.117,5.084-3.52,1.419-3.953.674-8.78.503-12.938-.15-3.656.068-11.444-3.431-13.736-3.134-2.053-7.36,1.476-10.154,2.71-4.823,2.129-9.656,4.28-14.324,6.735-1.168.614-2.342,1.239-3.436,1.98Z"
              data-title="Right Upper Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-13', e)}
            />

            {/* Right Middle Rectus Abdominis */}
            <path 
              id="path-14"
              className="body-area"
              fill={getAreaColor('path-14')}
              stroke="#374151" 
              strokeWidth="1"
              d="M291.355,263.617c-2.32.556-2.731,1.335-4.96,2.409-2.755,1.328-5.468,2.746-8.144,4.226-4.152,2.296-9.261,4.681-12.539,8.216-.127.137-.252.275-.364.426-2.649,3.571-2.765,15.666-2.534,16.472.23.806,30.132,3.168,31.62-1.094,1.258-3.602.295-7.426.432-11.181.199-5.423.495-11.886-.086-16.724-.048-.4-2.333-3.011-3.424-2.75Z"
              data-title="Right Middle Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-14', e)}
            />

            {/* Right Lower Rectus Abdominis */}
            <path 
              id="path-15"
              className="body-area"
              fill={getAreaColor('path-15')}
              stroke="#374151" 
              strokeWidth="1"
              d="M262.734,302.853c-1.879,5.529-.842,19.582,1.462,21.541,2.304,1.958,26.494,1.87,29.028,1.754,2.534-.115,2.377-12.237,2.419-16.153.042-3.916.306-10.577-1.191-11.153-1.497-.576-12.401-.481-15.742.786s-15.976,3.225-15.976,3.225Z"
              data-title="Right Lower Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-15', e)}
            />

            {/* Right Pubic Area */}
            <path 
              id="path-16"
              className="body-area"
              fill={getAreaColor('path-16')}
              stroke="#374151" 
              strokeWidth="1"
              d="M262.734,330.729c.54,8.524,5.867,78.281,26.761,83.197,1.958.461,4.048,2.568,4.638,1.417,1.555-3.686,1.553-77.703,1.553-80.928s-4.943-3.556-7.477-4.247c-2.534-.691-23.013-1.282-24.244-.361l-1.231.921Z"
              data-title="Right Pubic Area"
              onClick={(e) => handleAreaClick('path-16', e)}
            />

            {/* Right Oblique */}
            <path 
              id="path-17"
              className="body-area"
              fill={getAreaColor('path-17')}
              stroke="#374151" 
              strokeWidth="1"
              d="M236.903,314.121c.132-.323.56-.375.801-.123,9.73,10.168,16.542,13.251,18.429,14.773,1.785,1.44,2.304,33.06,4.377,40.893.933,3.525,2.727,7.034,1.162,7.792-2.073,1.004-7.541-1.515-9.097-3.213l-18.558-20.245s.412-33.807,2.887-39.877Z"
              data-title="Right Oblique"
              onClick={(e) => handleAreaClick('path-17', e)}
            />

            {/* Right Oblique */}
            <path 
              id="path-18"
              className="body-area"
              fill={getAreaColor('path-18')}
              stroke="#374151" 
              strokeWidth="1"
              d="M252.792,243.646c-7.833,6.681-11.311,9.868-12.153,11.346-.937,1.646,10.655,11.001,13.765,12.037,3.11,1.037,1.382-8.524,1.382-11.173s.23-13.016,0-13.708c-.23-.691-2.995,1.497-2.995,1.497Z"
              data-title="Right Oblique"
              onClick={(e) => handleAreaClick('path-18', e)}
            />

            {/* Right Oblique */}
            <path 
              id="path-19"
              className="body-area"
              fill={getAreaColor('path-19')}
              stroke="#374151" 
              strokeWidth="1"
              d="M239.622,261.282c.207-.656,1.027-.882,1.527-.409,3.581,3.381,13.459,8.44,14.019,10.246.434,1.401,1.37,11.62.103,11.965-1.267.346-18.591-11.663-18.375-12.752.287-1.448,1.912-6.471,2.726-9.049Z"
              data-title="Right Oblique"
              onClick={(e) => handleAreaClick('path-19', e)}
            />

            {/* Right Sternocleidomastoideus */}
            <path 
              id="path-20"
              className="body-area"
              fill={getAreaColor('path-20')}
              stroke="#374151" 
              strokeWidth="1"
              d="M275.427,104.899c7.775,6.278,7.924,13.142,11.346,19.986,9.849,19.698,6.263,31.583,3.977,29.134-6.66-7.133-13.595-29.94-14.632-31.841s-.691-17.279-.691-17.279Z"
              data-title="Right Sternocleidomastoideus"
              onClick={(e) => handleAreaClick('path-20', e)}
            />

            {/* Right Trap Front */}
            <path 
              id="path-21"
              className="body-area"
              fill={getAreaColor('path-21')}
              stroke="#374151" 
              strokeWidth="1"
              d="M274.229,133.466c-.922,7.142-.353,9.503,1.143,13.304,1.495,3.801,9.904,7.775,10.71,8.351-4.55-10.885-8.754-18.373-10.71-25.169-1.615.346-1.143,3.513-1.143,3.513Z"
              data-title="Right Trap Front"
              onClick={(e) => handleAreaClick('path-21', e)}
            />

            {/* Right Trapezius */}
            <path 
              id="path-22"
              className="body-area"
              fill={getAreaColor('path-22')}
              stroke="#374151" 
              strokeWidth="1"
              d="M268.458,132.142c-3.917,4.723-18.776,14.485-22.923,15.781-.691,2.678,21.08,5.126,23.844,2.937,2.765-2.189,2.765-16.299,2.304-18.718-.461-2.419-3.225,0-3.225,0Z"
              data-title="Right Trapezius"
              onClick={(e) => handleAreaClick('path-22', e)}
            />

            {/* Right Deltoideus */}
            <path 
              id="path-23"
              className="body-area"
              fill={getAreaColor('path-23')}
              stroke="#374151" 
              strokeWidth="1"
              d="M241.798,157.599c-2.08,1.355-4.93,1.979-7.186,3.019-6.647,3.063-12.813,6.385-12.751,14.538.048,6.345.81,13.214-2.627,18.548-2.188,3.395-5.075,6.244-7.634,9.347-2.531,3.068-4.025,5.849-8.338,3.594-10.118-5.289-17.109-15.684-16.215-27.328.494-6.438,3.415-12.654,7.999-17.194,5.089-5.04,10.033-9.995,16.604-13.184,9.005-4.369,19.032-2.763,27.149,2.833,2.937,2.025,3.001,5.826,3.001,5.826Z"
              data-title="Right Deltoideus"
              onClick={(e) => handleAreaClick('path-23', e)}
            />

            {/* Right Biceps Brachii SH */}
            <path 
              id="path-24"
              className="body-area"
              fill={getAreaColor('path-24')}
              stroke="#374151" 
              strokeWidth="1"
              d="M211.725,226.243c-4.234,15.75-20.53,50.82-20.795,51.645-.649,2.016.624,4.682,2.278,5.885,2.591,1.884,5.315-2.103,6.712-3.826,9.446-11.651,17.787-33.573,19.122-38.951,1.599-6.444,6.681-15.551,4.608-26.378-2.073-10.828-3.917-15.896-4.838-14.744-1.214,1.522-1.478,4.704-1.95,6.523-1.276,4.914-1.949,9.993-3.345,14.838-.489,1.696-1.327,3.285-1.791,5.009Z"
              data-title="Right Biceps Brachii SH"
              onClick={(e) => handleAreaClick('path-24', e)}
            />

            {/* Right Biceps Brachii LH */}
            <path 
              id="path-25"
              className="body-area"
              fill={getAreaColor('path-25')}
              stroke="#374151" 
              strokeWidth="1"
              d="M196.119,214.119c-5.361,2.765-14.451,18.56-15.723,26.436-2.361,14.615-1.644,22.577-1.785,26.897-.141,4.32,7.603,3.456,14.053-2.419,4.017-3.659,14.828-28.222,12.671-40.355-1.575-8.86-4.377-12.633-9.215-10.559Z"
              data-title="Right Biceps Brachii LH"
              onClick={(e) => handleAreaClick('path-25', e)}
            />

            {/* Right Forearm Lateral */}
            <path 
              id="path-26"
              className="body-area"
              fill={getAreaColor('path-26')}
              stroke="#374151" 
              strokeWidth="1"
              d="M176.191,273.923c5.78-2.878,2.97,34.978-1.037,44.942-4.262,10.6-9.823,24.717-15.205,37.667-3.218,7.744-12.325,35.824-16.242,37.667-3.917,1.843-.23-16.703,1.613-24.075,1.843-7.372,7.142-38.028,8.754-43.78,1.613-5.752.461-21.785,4.608-27.706,4.147-5.921,8.985-20.47,17.509-24.715Z"
              data-title="Right Forearm Lateral"
              onClick={(e) => handleAreaClick('path-26', e)}
            />

            {/* Right Forearm Central */}
            <path 
              id="path-27"
              className="body-area"
              fill={getAreaColor('path-27')}
              stroke="#374151" 
              strokeWidth="1"
              d="M191.914,292.947c2.995,11.289-1.699,22.03-4.003,28.711-2.304,6.681-6.825,13.218-10.972,19.669-4.147,6.451-15.568,33.295-18.258,40.432-6.445,17.106-9.561,12.21-7.027,5.76,2.534-6.451,7.315-21.08,10.31-27.991,2.995-6.911,3.859-11.006,7.43-18.834,3.513-7.701,7.545-15.954,10.079-22.865,2.534-6.911,3.686-23.729,7.833-24.881,4.147-1.152,4.608,0,4.608,0Z"
              data-title="Right Forearm Central"
              onClick={(e) => handleAreaClick('path-27', e)}
            />

            {/* Right Forearm Medial */}
            <path 
              id="path-28"
              className="body-area"
              fill={getAreaColor('path-28')}
              stroke="#374151" 
              strokeWidth="1"
              d="M181.432,340.492c-5.089,6.451-9.024,14.922-11.577,20.878-2.359,5.504-4.624,11.051-6.816,16.624-2.031,5.165-4.106,10.358-5.695,15.68-.265.887-1.054,2.194-.679,3.122.956-.773,1.421-1.964,2.023-2.996.634-1.086,1.232-2.192,1.811-3.307,1.369-2.636,2.636-5.325,3.869-8.027,2.797-6.131,5.41-12.344,8.097-18.523,2.309-5.311,4.597-10.675,7.387-15.756.139-.253.279-.505.422-.755,6.681-11.749,8.754-14.975,11.519-21.886,2.765-6.911,8.754-18.2,7.833-20.274-.642-1.444-2.957-3.755-3.968-4.492-.353-.257-.658,1.983-.691,2.419-1.091,14.395-8.927,31.452-13.535,37.293Z"
              data-title="Right Forearm Medial"
              onClick={(e) => handleAreaClick('path-28', e)}
            />

            {/* Right Patella */}
            <path 
              id="path-29"
              className="body-area"
              fill={getAreaColor('path-29')}
              stroke="#374151" 
              strokeWidth="1"
              d="M243.807,570.037c3.629,0,15.729.864,17.108,2.246s3.971,20.561-3.631,30.929c-7.603,10.367-14.168,5.011-16.242-1.037-2.073-6.048-8.466-22.98-6.048-28.164s8.812-3.974,8.812-3.974Z"
              data-title="Right Patella"
              onClick={(e) => handleAreaClick('path-29', e)}
            />

            {/* Right Medial Knee */}
            <path 
              id="path-30"
              className="body-area"
              fill={getAreaColor('path-30')}
              stroke="#374151" 
              strokeWidth="1"
              d="M266.788,581.786c-2.592,11.922-4.308,17.106-12.441,33.175-6.666,13.172-8.993,25.399-5.879,25.054,3.114-.346,14.345-26.284,16.073-31.106,1.728-4.822,6.927-19.59,7.343-22.631.588-4.293-.777-7.084-1.814-8.294-1.037-1.21-3.283,3.801-3.283,3.801Z"
              data-title="Right Medial Knee"
              onClick={(e) => handleAreaClick('path-30', e)}
            />

            {/* Right Calf Front */}
            <path 
              id="path-31"
              className="body-area"
              fill={getAreaColor('path-31')}
              stroke="#374151" 
              strokeWidth="1"
              d="M265.809,617.092c-2.995,9.215-13.592,23.499-14.284,32.484-.691,8.985,6.292,66.465,5.529,73.607,2.806-4.876,6.329-27.42,11.289-39.28,3.055-7.304,5.384-17.028,0-49.762-1.57-9.548-2.534-17.048-2.534-17.048Z"
              data-title="Right Calf Front"
              onClick={(e) => handleAreaClick('path-31', e)}
            />

            {/* Right Tibialis Anterior */}
            <path 
              id="path-32"
              className="body-area"
              fill={getAreaColor('path-32')}
              stroke="#374151" 
              strokeWidth="1"
              d="M234.457,590.944c3.822,25.918,16.608,87.775,17.99,115.42s.346,24.017-.864,26.263c-1.209,2.246-12.268-28.452-15.723-45.73-3.456-17.279-7.603-59.438-5.99-75.565,1.613-16.127.922-28.567,2.534-27.876,1.613.691,2.053,7.487,2.053,7.487Z"
              data-title="Right Tibialis Anterior"
              onClick={(e) => handleAreaClick('path-32', e)}
            />

            {/* Right Digitorum Longus */}
            <path 
              id="path-33"
              className="body-area"
              fill={getAreaColor('path-33')}
              stroke="#374151" 
              strokeWidth="1"
              d="M224.571,621.009c-1.613,18.891-.922,54.139,1.613,68.884,2.534,14.744,10.367,44.463,11.058,49.532s-1.613,10.828,0,12.671c1.613,1.843,7.142-9.673,6.22-19.35-.921-9.678-7.906-34.328-9.828-44.004-1.921-9.676-6.76-34.096-6.529-42.62.23-8.524.23-19.352.691-27.876.461-8.524,1.613-11.98,0-11.98s-3.225,14.744-3.225,14.744Z"
              data-title="Right Digitorum Longus"
              onClick={(e) => handleAreaClick('path-33', e)}
            />

            {/* Right Ankle */}
            <path 
              id="path-34"
              className="body-area"
              fill={getAreaColor('path-34')}
              stroke="#374151" 
              strokeWidth="1"
              d="M236.505,773.751c4.304,7.89,19.352,11.289,21.425,18.891,3.225-2.995,5.76-15.205,4.147-22.117-1.613-6.911-2.995-11.98-4.608-14.284-1.613-2.304-2.083-3.458-3.686-5.76-1.434-2.059-6.335-7.228-10.022-3.081-3.686,4.147-3.04,6.076-3.881,11.605-.841,5.529-4.758,12.21-3.376,14.744Z"
              data-title="Right Ankle"
              onClick={(e) => handleAreaClick('path-34', e)}
            />

            {/* Right Ankle Ligaments */}
            <path 
              id="path-35"
              className="body-area"
              fill={getAreaColor('path-35')}
              stroke="#374151" 
              strokeWidth="1"
              d="M249.509,738.675c8.466,7.66,10.713,18.661,10.713,15.896s.518-10.54-2.592-13.996-4.804-3.974-6.808-3.974-1.313,2.073-1.313,2.073Z"
              data-title="Right Ankle Ligaments"
              onClick={(e) => handleAreaClick('path-35', e)}
            />

            {/* Right Foot Front */}
            <path 
              id="path-36"
              className="body-area"
              fill={getAreaColor('path-36')}
              stroke="#374151" 
              strokeWidth="1"
              d="M239.142,786.191c-2.592,6.739-17.106,23.096-18.834,26.378-1.728,3.283,9.906,6.681,12.325,6.681s9.906,1.44,11.634,2.304c1.728.864,2.131-5.472,2.304-7.545.173-2.073,6.6-12.441,4.25-17.451-2.35-5.011,3.468-3.456-1.428-6.566-4.896-3.11-10.252-3.801-10.252-3.801Z"
              data-title="Right Foot Front"
              onClick={(e) => handleAreaClick('path-36', e)}
            />

            {/* Right Feet Toe */}
            <path 
              id="path-37"
              className="body-area"
              fill={getAreaColor('path-37')}
              stroke="#374151" 
              strokeWidth="1"
              d="M252.677,801.224c0,3.974-.139,8.812-2.488,14.687-2.35,5.875.518,7.603,1.244,7.257s5.737-1.382,5.737-1.382c0,0,1.901-3.11,1.382-5.011-.518-1.901,4.608-7.385,1.843-11.922s-3.468-9.734-4.147-11.289c-.679-1.555-3.571,7.66-3.571,7.66Z"
              data-title="Right Feet Toe"
              onClick={(e) => handleAreaClick('path-37', e)}
            />

            {/* Right Hand Front */}
            <path 
              id="path-38"
              className="body-area"
              fill={getAreaColor('path-38')}
              stroke="#374151" 
              strokeWidth="1"
              d="M137.785,400.651c.952-.165,1.912-.208,2.875-.094,5.489.65,15.052,1.756,17.232,7.963.253.721.272,1.5.279,2.263.073,8.09-.91,16.207-2.992,24.028-.391,1.469-.848,2.953-1.719,4.199-4.913,7.033-18.156,2.252-23.698-1.257-5.005-3.169-12.53-8.074-12.877-14.513-.309-5.724,3.115-11.867,7.725-15.136,3.776-2.677,8.375-6.621,13.175-7.453Z"
              data-title="Right Hand Front"
              onClick={(e) => handleAreaClick('path-38', e)}
            />

            {/* Right 5th Finger */}
            <path 
              id="path-39"
              className="body-area"
              fill={getAreaColor('path-39')}
              stroke="#374151" 
              strokeWidth="1"
              d="M145.792,445.346c-.066,3.659-.117,7.324-.093,10.983.021,2.354.092,4.711.328,7.055.196,1.949.243,5.565,1.473,7.101.732.914,2.794-4.711,2.862-5.052.32-1.595.264-21.431,1.128-21.531-1.926.222-3.871.804-5.698,1.443Z"
              data-title="Right 5th Finger"
              onClick={(e) => handleAreaClick('path-39', e)}
            />

            {/* Right 4th Finger */}
            <path 
              id="path-40"
              className="body-area"
              fill={getAreaColor('path-40')}
              stroke="#374151" 
              strokeWidth="1"
              d="M134.319,445.047c-1.523,6.391-2.055,13.079-3.14,19.561-.355,2.121-.713,4.241-1.042,6.365-.436,2.811-.916,5.13-.602,8.022.029.268.069.553.242.76.8.954,2.703-.017,3.288-.743.646-.801.908-1.841,1.073-2.856.46-2.826,1.13-5.615,1.701-8.424.865-4.257,1.679-8.525,2.54-12.783.529-2.616,1.058-5.233,1.587-7.849.064-.318.126-.663-.015-.956-.287-.599-5.617-1.159-5.633-1.095Z"
              data-title="Right 4th Finger"
              onClick={(e) => handleAreaClick('path-40', e)}
            />

            {/* Right 3rd Finger */}
            <path 
              id="path-41"
              className="body-area"
              fill={getAreaColor('path-41')}
              stroke="#374151" 
              strokeWidth="1"
              d="M124.193,442.211c-.915.95-1.531,4.44-1.822,5.309-.794,2.38-1.639,4.742-2.51,7.095-1.709,4.62-3.522,9.2-5.27,13.805-1.166,3.071-2.696,6.035-2.656,9.405.022,1.801,2.25.911,3.191.465,3.017-1.428,3.4-3.799,4.533-6.595.877-2.162,1.774-4.316,2.679-6.467,2.805-6.668,5.649-13.31,8.848-19.802.119-.242.241-.49.268-.759.244-2.389-5.37-2.642-6.781-2.696-.169-.006-.329.081-.482.239Z"
              data-title="Right 3rd Finger"
              onClick={(e) => handleAreaClick('path-41', e)}
            />

            {/* Right 2nd Finger */}
            <path 
              id="path-42"
              className="body-area"
              fill={getAreaColor('path-42')}
              stroke="#374151" 
              strokeWidth="1"
              d="M116.225,434.821c-1.627,1.365-5.061,9.13-5.662,10.239-1.724,3.186-3.444,6.375-5.163,9.565-1.388,2.576-4.108,5.953-4.429,8.92-.097.73-.772,4.757,1.019,3.941.268-.122.473-.349.668-.57,4.724-5.354,8.395-11.299,12.451-17.141,1.19-1.713,2.321-3.469,3.582-5.132,1.086-1.432,2.945-2.766,3.802-4.299.372-.666.327-1.477.271-2.238-.02-.273-.044-.559-.188-.791-.133-.214-.353-.357-.568-.489-1.638-1.003-3.434-1.749-5.3-2.202-.132-.032-.296.04-.483.197Z"
              data-title="Right 2nd Finger"
              onClick={(e) => handleAreaClick('path-42', e)}
            />

            {/* Right 1st Finger */}
            <path 
              id="path-43"
              className="body-area"
              fill={getAreaColor('path-43')}
              stroke="#374151" 
              strokeWidth="1"
              d="M114.91,410.902c-2.88,2.765-7.603,8.16-9.561,12.259-1.958,4.098-10.367,5.711-10.482,8.245-.115,2.534-.691,4.147.461,4.262,1.152.115,5.529.346,8.178-2.073,2.649-2.419,4.608-3.801,6.335-6.22,1.728-2.419,3.225-5.299,4.032-9.1.806-3.801,3.11-9.1,3.11-9.1l-2.073,1.728Z"
              data-title="Right 1st Finger"
              onClick={(e) => handleAreaClick('path-43', e)}
            />

            {/* Right Larynx */}
            <path 
              id="path-44"
              className="body-area"
              fill={getAreaColor('path-44')}
              stroke="#374151" 
              strokeWidth="1"
              d="M297.515,110.602c.194,8.985,1.311,24.074.123,27.414-1.188,3.34-4.036-8.524-7.911-16.703-3.875-8.178-2.416-5.107-3.453-8.793-1.037-3.686-7.103-3.341-2.957-3.686,4.147-.346,14.198,1.767,14.198,1.767Z"
              data-title="Right Larynx"
              onClick={(e) => handleAreaClick('path-44', e)}
            />

            {/* Right Pubis Adductor */}
            <path 
              id="path-45"
              className="body-area"
              fill={getAreaColor('path-45')}
              stroke="#374151" 
              strokeWidth="1"
              d="M249.276,377.003c7.091,5.299,29.207,33.405,36.411,68.653,0,0-3.772,12.623-8.832,11.519-1.125-.246-17.379-52.008-30.337-76.025-3.715-6.885-3.974-10.54-3.974-10.54l6.732,6.393Z"
              data-title="Right Pubis Adductor"
              onClick={(e) => handleAreaClick('path-45', e)}
            />

            {/* Right Adductor Long */}
            <path 
              id="path-46"
              className="body-area"
              fill={getAreaColor('path-46')}
              stroke="#374151" 
              strokeWidth="1"
              d="M238.624,377.209c8.806,29.316,38.107,140.609,37.581,157.926,8.807-25.201,1.584-58.344-9.244-90.194-9.055-26.635-28.337-67.732-28.337-67.732Z"
              data-title="Right Adductor Long"
              onClick={(e) => handleAreaClick('path-46', e)}
            />

            {/* Right Rectus Femoris */}
            <path 
              id="path-47"
              className="body-area"
              fill={getAreaColor('path-47')}
              stroke="#374151" 
              strokeWidth="1"
              d="M234.016,383.486c5.529,25.788,24.43,67.339,26.827,103.326,2.31,34.679-1.773,69.811-8.223,72.575-6.451,2.765-17.414-42.887-19.294-50.574-4.768-19.495-15.251-55.099-14.099-73.491.994-15.877,3.668-24.197,5.805-31.562,2.871-9.895,8.985-20.274,8.985-20.274Z"
              data-title="Right Rectus Femoris"
              onClick={(e) => handleAreaClick('path-47', e)}
            />

            {/* Right Vastus Lateralis */}
            <path 
              id="path-48"
              className="body-area"
              fill={getAreaColor('path-48')}
              stroke="#374151" 
              strokeWidth="1"
              d="M221.691,472.528c1.152,10.367,8.121,44.291,16.933,66.234,4.104,10.219,5.299,21.195,2.073,24.651-3.225,3.456-6.911-15.666-11.98-23.729s-9.3-34.09-9.579-44.579c-.364-13.687-2.631-24.42-1.479-28.106,1.152-3.686,4.032,5.529,4.032,5.529Z"
              data-title="Right Vastus Lateralis"
              onClick={(e) => handleAreaClick('path-48', e)}
            />

            {/* Right Vastus Medialis */}
            <path 
              id="path-49"
              className="body-area"
              fill={getAreaColor('path-49')}
              stroke="#374151" 
              strokeWidth="1"
              d="M263.404,494.76c3.556,39.683-6.318,58.977-1.051,67.271,5.267,8.294,9.404,4.694,8.754.115-1.154-8.131,5.011-21.348,0-44.809-2.649-12.404-7.703-22.577-7.703-22.577Z"
              data-title="Right Vastus Medialis"
              onClick={(e) => handleAreaClick('path-49', e)}
            />

            {/* Right Adductor Short */}
            <path 
              id="path-50"
              className="body-area"
              fill={getAreaColor('path-50')}
              stroke="#374151" 
              strokeWidth="1"
              d="M287.58,450.758c-4.262,6.335-10.021,12.231-9.906,14.237.115,2.005,5.99,32.415,5.644,35.871,3.571-3.456,6.911-44.924,6.681-48.726-.23-3.801-2.419-1.382-2.419-1.382Z"
              data-title="Right Adductor Short"
              onClick={(e) => handleAreaClick('path-50', e)}
            />

            {/* Left Pectoralis Major */}
            <path 
              id="path-51"
              className="body-area"
              fill={getAreaColor('path-51')}
              stroke="#374151" 
              strokeWidth="1"
              d="M368.443,187.139c1.11,14.865-2.785,32.845-14.754,39.98-4.395,2.62-9.492,3.764-14.508,4.776-15.745,3.176-34.78-4.665-36.319-19.053-1.646-15.393-3.99-33.818,2.921-47.295,4.597-8.965,9.04-8.985,14.051-9.503s20.506-1.037,26.554,1.728c7.862,3.594,17.123,8.812,19.884,17.508,1.098,3.458,1.847,7.526,2.17,11.86Z"
              data-title="Left Pectoralis Major"
              onClick={(e) => handleAreaClick('path-51', e)}
            />

            {/* Left Intercostal */}
            <path 
              id="path-52"
              className="body-area"
              fill={getAreaColor('path-52')}
              stroke="#374151" 
              strokeWidth="1"
              d="M363.61,221.529c-4.838,5.702-12.039,9.693-16.184,11.814-2.092,1.071-2.304,5.119-.576,5.637s15.896-4.536,17.624-7.711c1.728-3.175,2.246-7.84,1.901-9.74-.346-1.901-2.765,0-2.765,0Z"
              data-title="Left Intercostal"
              onClick={(e) => handleAreaClick('path-52', e)}
            />

            {/* Left Intercostal */}
            <path 
              id="path-53"
              className="body-area"
              fill={getAreaColor('path-53')}
              stroke="#374151" 
              strokeWidth="1"
              d="M368.436,234.913c.065.384.058.769-.044,1.145-1.608,5.964-7.282,15.951-9.563,17.091-1.382.691-7.775-6.22-8.639-6.739-.864-.518-2.765-3.11-2.765-3.11,0,0,13.733-4.963,16.343-7.343.924-.843,3.918-5.5,3.918-5.5l.75,4.456Z"
              data-title="Left Intercostal"
              onClick={(e) => handleAreaClick('path-53', e)}
            />

            {/* Left Intercostal */}
            <path 
              id="path-54"
              className="body-area"
              fill={getAreaColor('path-54')}
              stroke="#374151" 
              strokeWidth="1"
              d="M367.468,245.892s1.21,9.158-2.073,16.069c-3.283,6.911-4.665,7.775-4.665,7.775,0,0-4.147-11.058-2.419-12.786,1.728-1.728,9.158-11.058,9.158-11.058Z"
              data-title="Left Intercostal"
              onClick={(e) => handleAreaClick('path-54', e)}
            />

            {/* Left Oblique */}
            <path 
              id="path-55"
              className="body-area"
              fill={getAreaColor('path-55')}
              stroke="#374151" 
              strokeWidth="1"
              d="M358.093,290.557c-2.189,3.34-16.687,14.255-18.184,16.098-1.497,1.843.014,13.103-.49,17.509,5.76-1.382,17.991-11.461,18.798-15.378.806-3.917-.124-18.229-.124-18.229Z"
              data-title="Left Oblique"
              onClick={(e) => handleAreaClick('path-55', e)}
            />

            {/* Left Oblique */}
            <path 
              id="path-56"
              className="body-area"
              fill={getAreaColor('path-56')}
              stroke="#374151" 
              strokeWidth="1"
              d="M358.829,272.52c-.806.864-13.564,11.577-18.893,14.085-2.283,1.075-.516,17.707-.516,17.707,0,0,15.762-12.705,18.14-16.506,2.378-3.801,1.471-6.247,1.701-7.859s-.432-7.427-.432-7.427Z"
              data-title="Left Oblique"
              onClick={(e) => handleAreaClick('path-56', e)}
            />

            {/* Left Upper Rectus Abdominis */}
            <path 
              id="path-57"
              className="body-area"
              fill={getAreaColor('path-57')}
              stroke="#374151" 
              strokeWidth="1"
              d="M332.048,240.363c3.086,2.094,3.11,8.121,3.629,10.54.518,2.419-1.21,13.304-1.21,13.304,0,0-1.728,8.639-2.419,9.676-.865,1.293-23.573-13.398-25.758-14.752-1.84-1.14-4.222-1.117-5.084-3.52-1.419-3.953-.674-8.78-.503-12.938.15-3.656-.068-11.444,3.431-13.736,3.134-2.053,7.36,1.476,10.154,2.71,4.823,2.129,9.657,4.28,14.324,6.735,1.168.614,2.342,1.239,3.436,1.98Z"
              data-title="Left Upper Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-57', e)}
            />

            {/* Left Middle Rectus Abdominis */}
            <path 
              id="path-58"
              className="body-area"
              fill={getAreaColor('path-58')}
              stroke="#374151" 
              strokeWidth="1"
              d="M303.852,263.617c2.32.556,2.731,1.335,4.96,2.409,2.755,1.328,5.468,2.746,8.144,4.226,4.152,2.296,9.261,4.681,12.539,8.216.127.137.252.275.364.426,2.649,3.571,2.765,15.666,2.534,16.472-.23.806-30.132,3.168-31.62-1.094-1.258-3.602-.295-7.426-.432-11.181-.199-5.423-.495-11.886.086-16.724.048-.4,2.333-3.011,3.424-2.75Z"
              data-title="Left Middle Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-58', e)}
            />

            {/* Left Lower Rectus Abdominis */}
            <path 
              id="path-59"
              className="body-area"
              fill={getAreaColor('path-59')}
              stroke="#374151" 
              strokeWidth="1"
              d="M332.472,302.853c1.879,5.529.842,19.582-1.462,21.541-2.304,1.958-26.494,1.87-29.028,1.754-2.534-.115-2.377-12.237-2.419-16.153-.042-3.916-.306-10.577,1.191-11.153,1.498-.576,12.401-.481,15.742.786,3.34,1.267,15.976,3.225,15.976,3.225Z"
              data-title="Left Lower Rectus Abdominis"
              onClick={(e) => handleAreaClick('path-59', e)}
            />

            {/* Left Pubic Area */}
            <path 
              id="path-60"
              className="body-area"
              fill={getAreaColor('path-60')}
              stroke="#374151" 
              strokeWidth="1"
              d="M332.472,330.729c-.54,8.524-5.867,78.281-26.761,83.197-1.958.461-4.048,2.568-4.638,1.417-1.555-3.686-1.553-77.703-1.553-80.928s4.943-3.556,7.477-4.247c2.534-.691,23.013-1.282,24.245-.361l1.231.921Z"
              data-title="Left Pubic Area"
              onClick={(e) => handleAreaClick('path-60', e)}
            />

            {/* Left Oblique */}
            <path 
              id="path-61"
              className="body-area"
              fill={getAreaColor('path-61')}
              stroke="#374151" 
              strokeWidth="1"
              d="M358.304,314.121c-.132-.323-.56-.375-.801-.123-9.73,10.168-16.542,13.251-18.429,14.773-1.785,1.44-2.304,33.06-4.377,40.893-.933,3.525-2.727,7.034-1.162,7.792,2.073,1.004,7.541-1.515,9.097-3.213l18.558-20.245s-.412-33.807-2.887-39.877Z"
              data-title="Left Oblique"
              onClick={(e) => handleAreaClick('path-61', e)}
            />

            {/* Left Oblique */}
            <path 
              id="path-62"
              className="body-area"
              fill={getAreaColor('path-62')}
              stroke="#374151" 
              strokeWidth="1"
              d="M342.415,243.646c7.833,6.681,11.311,9.868,12.153,11.346.937,1.646-10.655,11.001-13.765,12.037s-1.382-8.524-1.382-11.173-.23-13.016,0-13.708c.23-.691,2.995,1.497,2.995,1.497Z"
              data-title="Left Oblique"
              onClick={(e) => handleAreaClick('path-62', e)}
            />

            {/* Left Oblique */}
            <path 
              id="path-63"
              className="body-area"
              fill={getAreaColor('path-63')}
              stroke="#374151" 
              strokeWidth="1"
              d="M355.585,261.282c-.207-.656-1.026-.882-1.527-.409-3.581,3.381-13.459,8.44-14.019,10.246-.434,1.401-1.37,11.62-.103,11.965,1.267.346,18.591-11.663,18.375-12.752-.287-1.448-1.912-6.471-2.726-9.049Z"
              data-title="Left Oblique"
              onClick={(e) => handleAreaClick('path-63', e)}
            />

            {/* Left Sternocleidomastoideus */}
            <path 
              id="path-64"
              className="body-area"
              fill={getAreaColor('path-64')}
              stroke="#374151" 
              strokeWidth="1"
              d="M319.78,104.899c-7.775,6.278-7.924,13.142-11.346,19.986-9.849,19.698-6.263,31.583-3.977,29.134,6.66-7.133,13.595-29.94,14.632-31.841s.691-17.279.691-17.279Z"
              data-title="Left Sternocleidomastoideus"
              onClick={(e) => handleAreaClick('path-64', e)}
            />

            {/* Left Trap Front */}
            <path 
              id="path-65"
              className="body-area"
              fill={getAreaColor('path-65')}
              stroke="#374151" 
              strokeWidth="1"
              d="M320.978,133.466c.922,7.142.353,9.503-1.143,13.304-1.495,3.801-9.904,7.775-10.71,8.351,4.55-10.885,8.754-18.373,10.71-25.169,1.615.346,1.143,3.513,1.143,3.513Z"
              data-title="Left Trap Front"
              onClick={(e) => handleAreaClick('path-65', e)}
            />

            {/* Left Trapezius */}
            <path 
              id="path-66"
              className="body-area"
              fill={getAreaColor('path-66')}
              stroke="#374151" 
              strokeWidth="1"
              d="M326.749,132.142c3.916,4.723,18.776,14.485,22.923,15.781.691,2.678-21.08,5.126-23.844,2.937-2.765-2.189-2.765-16.299-2.304-18.718.461-2.419,3.225,0,3.225,0Z"
              data-title="Left Trapezius"
              onClick={(e) => handleAreaClick('path-66', e)}
            />

            {/* Left Deltoideus */}
            <path 
              id="path-67"
              className="body-area"
              fill={getAreaColor('path-67')}
              stroke="#374151" 
              strokeWidth="1"
              d="M353.409,157.599c2.08,1.355,4.93,1.979,7.186,3.019,6.647,3.063,12.813,6.385,12.751,14.538-.048,6.345-.81,13.214,2.627,18.548,2.188,3.395,5.075,6.244,7.634,9.347,2.531,3.068,4.025,5.849,8.338,3.594,10.118-5.289,17.109-15.684,16.215-27.328-.494-6.438-3.415-12.654-7.999-17.194-5.089-5.04-10.033-9.995-16.604-13.184-9.005-4.369-19.032-2.763-27.149,2.833-2.937,2.025-3.001,5.826-3.001,5.826Z"
              data-title="Left Deltoideus"
              onClick={(e) => handleAreaClick('path-67', e)}
            />

            {/* Left Biceps Brachii SH */}
            <path 
              id="path-68"
              className="body-area"
              fill={getAreaColor('path-68')}
              stroke="#374151" 
              strokeWidth="1"
              d="M383.482,226.243c4.234,15.75,20.53,50.82,20.795,51.645.649,2.016-.624,4.682-2.278,5.885-2.591,1.884-5.315-2.103-6.712-3.826-9.446-11.651-17.787-33.573-19.122-38.951-1.599-6.444-6.681-15.551-4.608-26.378,2.073-10.828,3.916-15.896,4.838-14.744,1.214,1.522,1.478,4.704,1.95,6.523,1.276,4.914,1.949,9.993,3.345,14.838.489,1.696,1.327,3.285,1.791,5.009Z"
              data-title="Left Biceps Brachii SH"
              onClick={(e) => handleAreaClick('path-68', e)}
            />

            {/* Left Biceps Brachii LH */}
            <path 
              id="path-69"
              className="body-area"
              fill={getAreaColor('path-69')}
              stroke="#374151" 
              strokeWidth="1"
              d="M399.088,214.119c5.361,2.765,14.451,18.56,15.723,26.436,2.361,14.615,1.644,22.577,1.785,26.897.141,4.32-7.603,3.456-14.053-2.419-4.017-3.659-14.828-28.222-12.671-40.355,1.575-8.86,4.377-12.633,9.215-10.559Z"
              data-title="Left Biceps Brachii LH"
              onClick={(e) => handleAreaClick('path-69', e)}
            />

            {/* Left Forearm Lateral */}
            <path 
              id="path-70"
              className="body-area"
              fill={getAreaColor('path-70')}
              stroke="#374151" 
              strokeWidth="1"
              d="M419.016,273.923c-5.779-2.878-2.97,34.978,1.037,44.942,4.262,10.6,9.824,24.717,15.205,37.667,3.218,7.744,12.325,35.824,16.242,37.667,3.916,1.843.23-16.703-1.613-24.075-1.843-7.372-7.142-38.028-8.754-43.78-1.613-5.752-.461-21.785-4.608-27.706-4.147-5.921-8.985-20.47-17.509-24.715Z"
              data-title="Left Forearm Lateral"
              onClick={(e) => handleAreaClick('path-70', e)}
            />

            {/* Right Forearm Central */}
            <path 
              id="path-71"
              className="body-area"
              fill={getAreaColor('path-71')}
              stroke="#374151" 
              strokeWidth="1"
              d="M403.293,292.947c-2.995,11.289,1.699,22.03,4.003,28.711,2.304,6.681,6.825,13.218,10.972,19.669,4.147,6.451,15.568,33.295,18.258,40.432,6.445,17.106,9.561,12.21,7.027,5.76-2.534-6.451-7.315-21.08-10.309-27.991-2.995-6.911-3.859-11.006-7.43-18.834-3.513-7.701-7.545-15.954-10.079-22.865-2.534-6.911-3.686-23.729-7.833-24.881-4.147-1.152-4.608,0-4.608,0Z"
              data-title="Right Forearm Central"
              onClick={(e) => handleAreaClick('path-71', e)}
            />

            {/* Left Forearm Medial */}
            <path 
              id="path-72"
              className="body-area"
              fill={getAreaColor('path-72')}
              stroke="#374151" 
              strokeWidth="1"
              d="M413.775,340.492c5.089,6.451,9.024,14.922,11.577,20.878,2.359,5.504,4.624,11.051,6.816,16.624,2.031,5.165,4.106,10.358,5.695,15.68.265.887,1.054,2.194.679,3.122-.956-.773-1.421-1.964-2.023-2.996-.634-1.086-1.232-2.192-1.811-3.307-1.369-2.636-2.636-5.325-3.869-8.027-2.797-6.131-5.41-12.344-8.097-18.523-2.309-5.311-4.597-10.675-7.387-15.756-.139-.253-.279-.505-.422-.755-6.681-11.749-8.754-14.975-11.519-21.886-2.765-6.911-8.754-18.2-7.833-20.274.642-1.444,2.957-3.755,3.968-4.492.353-.257.658,1.983.691,2.419,1.091,14.395,8.927,31.452,13.535,37.293Z"
              data-title="Left Forearm Medial"
              onClick={(e) => handleAreaClick('path-72', e)}
            />

            {/* Left Patella */}
            <path 
              id="path-73"
              className="body-area"
              fill={getAreaColor('path-73')}
              stroke="#374151" 
              strokeWidth="1"
              d="M351.399,570.037c-3.628,0-15.729.864-17.108,2.246s-3.972,20.561,3.631,30.929c7.603,10.367,14.168,5.011,16.242-1.037,2.073-6.048,8.466-22.98,6.048-28.164s-8.812-3.974-8.812-3.974Z"
              data-title="Left Patella"
              onClick={(e) => handleAreaClick('path-73', e)}
            />

            {/* Left Medial Knee */}
            <path 
              id="path-74"
              className="body-area"
              fill={getAreaColor('path-74')}
              stroke="#374151" 
              strokeWidth="1"
              d="M328.419,581.786c2.592,11.922,4.308,17.106,12.441,33.175,6.666,13.172,8.993,25.399,5.879,25.054-3.114-.346-14.345-26.284-16.073-31.106-1.728-4.822-6.927-19.59-7.343-22.631-.588-4.293.778-7.084,1.814-8.294,1.037-1.21,3.283,3.801,3.283,3.801Z"
              data-title="Left Medial Knee"
              onClick={(e) => handleAreaClick('path-74', e)}
            />

            {/* Left Calf Front */}
            <path 
              id="path-75"
              className="body-area"
              fill={getAreaColor('path-75')}
              stroke="#374151" 
              strokeWidth="1"
              d="M329.398,617.092c2.995,9.215,13.592,23.499,14.284,32.484.691,8.985-6.292,66.465-5.529,73.607-2.806-4.876-6.329-27.42-11.289-39.28-3.055-7.304-5.383-17.028,0-49.762,1.57-9.548,2.534-17.048,2.534-17.048Z"
              data-title="Left Calf Front"
              onClick={(e) => handleAreaClick('path-75', e)}
            />

            {/* Left Tibialis Anterior */}
            <path 
              id="path-76"
              className="body-area"
              fill={getAreaColor('path-76')}
              stroke="#374151" 
              strokeWidth="1"
              d="M360.75,590.944c-3.822,25.918-16.608,87.775-17.99,115.42-1.382,27.646-.346,24.017.864,26.263,1.21,2.246,12.268-28.452,15.723-45.73,3.456-17.279,7.603-59.438,5.99-75.565-1.613-16.127-.922-28.567-2.534-27.876-1.613.691-2.053,7.487-2.053,7.487Z"
              data-title="Left Tibialis Anterior"
              onClick={(e) => handleAreaClick('path-76', e)}
            />

            {/* Left Digitorum Longus */}
            <path 
              id="path-77"
              className="body-area"
              fill={getAreaColor('path-77')}
              stroke="#374151" 
              strokeWidth="1"
              d="M370.636,621.009c1.613,18.891.922,54.139-1.613,68.884-2.534,14.744-10.367,44.463-11.058,49.532-.691,5.068,1.613,10.828,0,12.671-1.613,1.843-7.142-9.673-6.22-19.35.922-9.678,7.906-34.328,9.828-44.004,1.922-9.676,6.759-34.096,6.529-42.62-.23-8.524-.23-19.352-.691-27.876-.461-8.524-1.613-11.98,0-11.98s3.225,14.744,3.225,14.744Z"
              data-title="Left Digitorum Longus"
              onClick={(e) => handleAreaClick('path-77', e)}
            />

            {/* Left Ankle */}
            <path 
              id="path-78"
              className="body-area"
              fill={getAreaColor('path-78')}
              stroke="#374151" 
              strokeWidth="1"
              d="M358.702,773.751c-4.304,7.89-19.352,11.289-21.425,18.891-3.225-2.995-5.759-15.205-4.147-22.117,1.613-6.911,2.995-11.98,4.608-14.284,1.613-2.304,2.083-3.458,3.686-5.76,1.434-2.059,6.335-7.228,10.021-3.081s3.04,6.076,3.881,11.605c.841,5.529,4.758,12.21,3.376,14.744Z"
              data-title="Left Ankle"
              onClick={(e) => handleAreaClick('path-78', e)}
            />

            {/* Left Ankle Ligaments */}
            <path 
              id="path-79"
              className="body-area"
              fill={getAreaColor('path-79')}
              stroke="#374151" 
              strokeWidth="1"
              d="M345.698,738.675c-8.466,7.66-10.713,18.661-10.713,15.896s-.518-10.54,2.592-13.996c3.11-3.456,4.804-3.974,6.808-3.974s1.313,2.073,1.313,2.073Z"
              data-title="Left Ankle Ligaments"
              onClick={(e) => handleAreaClick('path-79', e)}
            />

            {/* Left Foot Front */}
            <path 
              id="path-80"
              className="body-area"
              fill={getAreaColor('path-80')}
              stroke="#374151" 
              strokeWidth="1"
              d="M356.065,786.191c2.592,6.739,17.106,23.096,18.834,26.378,1.728,3.283-9.906,6.681-12.325,6.681s-9.906,1.44-11.634,2.304c-1.728.864-2.131-5.472-2.304-7.545s-6.6-12.441-4.25-17.451c2.35-5.011-3.468-3.456,1.428-6.566,4.896-3.11,10.252-3.801,10.252-3.801Z"
              data-title="Left Foot Front"
              onClick={(e) => handleAreaClick('path-80', e)}
            />

            {/* Left Feet Toe */}
            <path 
              id="path-81"
              className="body-area"
              fill={getAreaColor('path-81')}
              stroke="#374151" 
              strokeWidth="1"
              d="M342.53,801.224c0,3.974.139,8.812,2.488,14.687,2.35,5.875-.518,7.603-1.244,7.257s-5.737-1.382-5.737-1.382c0,0-1.901-3.11-1.382-5.011.518-1.901-4.608-7.385-1.843-11.922,2.765-4.537,3.468-9.734,4.147-11.289.679-1.555,3.571,7.66,3.571,7.66Z"
              data-title="Left Feet Toe"
              onClick={(e) => handleAreaClick('path-81', e)}
            />

            {/* Left Hand Front */}
            <path 
              id="path-82"
              className="body-area"
              fill={getAreaColor('path-82')}
              stroke="#374151" 
              strokeWidth="1"
              d="M457.422,400.651c-.952-.165-1.912-.208-2.875-.094-5.489.65-15.052,1.756-17.232,7.963-.253.721-.272,1.5-.279,2.263-.073,8.09.91,16.207,2.992,24.028.391,1.469.848,2.953,1.719,4.199,4.913,7.033,18.156,2.252,23.698-1.257,5.005-3.169,12.53-8.074,12.877-14.513.309-5.724-3.115-11.867-7.725-15.136-3.776-2.677-8.375-6.621-13.175-7.453Z"
              data-title="Left Hand Front"
              onClick={(e) => handleAreaClick('path-82', e)}
            />

            {/* Left 5th Finger */}
            <path 
              id="path-83"
              className="body-area"
              fill={getAreaColor('path-83')}
              stroke="#374151" 
              strokeWidth="1"
              d="M449.415,445.346c.066,3.659.117,7.324.093,10.983-.021,2.354-.092,4.711-.328,7.055-.196,1.949-.243,5.565-1.473,7.101-.732.914-2.794-4.711-2.862-5.052-.32-1.595-.263-21.431-1.128-21.531,1.926.222,3.871.804,5.698,1.443Z"
              data-title="Left 5th Finger"
              onClick={(e) => handleAreaClick('path-83', e)}
            />

            {/* Left 4th Finger */}
            <path 
              id="path-84"
              className="body-area"
              fill={getAreaColor('path-84')}
              stroke="#374151" 
              strokeWidth="1"
              d="M460.888,445.047c1.523,6.391,2.055,13.079,3.14,19.561.355,2.121.713,4.241,1.042,6.365.436,2.811.916,5.13.602,8.022-.029.268-.069.553-.242.76-.8.954-2.703-.017-3.288-.743-.646-.801-.908-1.841-1.073-2.856-.46-2.826-1.13-5.615-1.701-8.424-.865-4.257-1.679-8.525-2.54-12.783-.529-2.616-1.058-5.233-1.587-7.849-.064-.318-.126-.663.015-.956.287-.599,5.617-1.159,5.633-1.095Z"
              data-title="Left 4th Finger"
              onClick={(e) => handleAreaClick('path-84', e)}
            />

            {/* Left 3rd Finger */}
            <path 
              id="path-85"
              className="body-area"
              fill={getAreaColor('path-85')}
              stroke="#374151" 
              strokeWidth="1"
              d="M471.014,442.211c.915.95,1.531,4.44,1.822,5.309.794,2.38,1.639,4.742,2.51,7.095,1.709,4.62,3.522,9.2,5.27,13.805,1.166,3.071,2.696,6.035,2.656,9.405-.022,1.801-2.25.911-3.191.465-3.017-1.428-3.4-3.799-4.533-6.595-.877-2.162-1.774-4.316-2.679-6.467-2.805-6.668-5.649-13.31-8.848-19.802-.119-.242-.241-.49-.268-.759-.244-2.389,5.37-2.642,6.781-2.696.169-.006.329.081.482.239Z"
              data-title="Left 3rd Finger"
              onClick={(e) => handleAreaClick('path-85', e)}
            />

            {/* Left 2nd Finger */}
            <path 
              id="path-86"
              className="body-area"
              fill={getAreaColor('path-86')}
              stroke="#374151" 
              strokeWidth="1"
              d="M478.982,434.821c1.627,1.365,5.061,9.13,5.662,10.239,1.724,3.186,3.444,6.375,5.163,9.565,1.388,2.576,4.108,5.953,4.429,8.92.097.73.772,4.757-1.019,3.941-.268-.122-.473-.349-.668-.57-4.724-5.354-8.395-11.299-12.451-17.141-1.19-1.713-2.321-3.469-3.582-5.132-1.086-1.432-2.945-2.766-3.802-4.299-.372-.666-.327-1.477-.271-2.238.02-.273.044-.559.188-.791.133-.214.353-.357.568-.489,1.638-1.003,3.434-1.749,5.3-2.202.132-.032.296.04.483.197Z"
              data-title="Left 2nd Finger"
              onClick={(e) => handleAreaClick('path-86', e)}
            />

            {/* Left 1st Finger */}
            <path 
              id="path-87"
              className="body-area"
              fill={getAreaColor('path-87')}
              stroke="#374151" 
              strokeWidth="1"
              d="M480.297,410.902c2.88,2.765,7.603,8.16,9.561,12.259,1.958,4.098,10.367,5.711,10.482,8.245.115,2.534.691,4.147-.461,4.262-1.152.115-5.529.346-8.178-2.073-2.649-2.419-4.608-3.801-6.335-6.22-1.728-2.419-3.225-5.299-4.032-9.1-.806-3.801-3.11-9.1-3.11-9.1l2.073,1.728Z"
              data-title="Left 1st Finger"
              onClick={(e) => handleAreaClick('path-87', e)}
            />

            {/* Left Larynx */}
            <path 
              id="path-88"
              className="body-area"
              fill={getAreaColor('path-88')}
              stroke="#374151" 
              strokeWidth="1"
              d="M297.515,110.602c-.194,8.985-1.135,24.074.054,27.414,1.188,3.34,4.036-8.524,7.911-16.703,3.875-8.178,2.416-5.107,3.453-8.793,1.037-3.686,7.103-3.341,2.957-3.686-4.147-.346-14.374,1.767-14.374,1.767Z"
              data-title="Left Larynx"
              onClick={(e) => handleAreaClick('path-88', e)}
            />

            {/* Left Pubis Adductor */}
            <path 
              id="path-89"
              className="body-area"
              fill={getAreaColor('path-89')}
              stroke="#374151" 
              strokeWidth="1"
              d="M345.931,377.003c-7.091,5.299-29.207,33.405-36.411,68.653,0,0,3.772,12.623,8.832,11.519,1.125-.246,17.379-52.008,30.337-76.025,3.715-6.885,3.974-10.54,3.974-10.54l-6.732,6.393Z"
              data-title="Left Pubis Adductor"
              onClick={(e) => handleAreaClick('path-89', e)}
            />

            {/* Left Adductor Long */}
            <path 
              id="path-90"
              className="body-area"
              fill={getAreaColor('path-90')}
              stroke="#374151" 
              strokeWidth="1"
              d="M356.583,377.209c-8.806,29.316-38.107,140.609-37.581,157.926-8.807-25.201-1.584-58.344,9.244-90.194,9.055-26.635,28.337-67.732,28.337-67.732Z"
              data-title="Left Adductor Long"
              onClick={(e) => handleAreaClick('path-90', e)}
            />

            {/* Left Rectus Femoris */}
            <path 
              id="path-91"
              className="body-area"
              fill={getAreaColor('path-91')}
              stroke="#374151" 
              strokeWidth="1"
              d="M361.191,383.486c-5.529,25.788-24.429,67.339-26.827,103.326-2.31,34.679,1.773,69.811,8.223,72.575,6.451,2.765,17.414-42.887,19.294-50.574,4.768-19.495,15.251-55.099,14.099-73.491-.994-15.877-3.668-24.197-5.805-31.562-2.871-9.895-8.985-20.274-8.985-20.274Z"
              data-title="Left Rectus Femoris"
              onClick={(e) => handleAreaClick('path-91', e)}
            />

            {/* Left Vastus Lateralis */}
            <path 
              id="path-92"
              className="body-area"
              fill={getAreaColor('path-92')}
              stroke="#374151" 
              strokeWidth="1"
              d="M373.516,472.528c-1.152,10.367-8.121,44.291-16.933,66.234-4.104,10.219-5.299,21.195-2.073,24.651,3.225,3.456,6.911-15.666,11.98-23.729,5.068-8.063,9.3-34.09,9.579-44.579.364-13.687,2.631-24.42,1.479-28.106s-4.032,5.529-4.032,5.529Z"
              data-title="Left Vastus Lateralis"
              onClick={(e) => handleAreaClick('path-92', e)}
            />

            {/* Left Vastus Medialis */}
            <path 
              id="path-93"
              className="body-area"
              fill={getAreaColor('path-93')}
              stroke="#374151" 
              strokeWidth="1"
              d="M331.803,494.76c-3.556,39.683,6.318,58.977,1.051,67.271-5.267,8.294-9.404,4.694-8.754.115,1.154-8.131-5.011-21.348,0-44.809,2.649-12.404,7.703-22.577,7.703-22.577Z"
              data-title="Left Vastus Medialis"
              onClick={(e) => handleAreaClick('path-93', e)}
            />

            {/* Left Adductor Short */}
            <path 
              id="path-94"
              className="body-area"
              fill={getAreaColor('path-94')}
              stroke="#374151" 
              strokeWidth="1"
              d="M307.627,450.758c4.262,6.335,10.022,12.231,9.906,14.237-.115,2.005-5.99,32.415-5.644,35.871-3.571-3.456-6.911-44.924-6.681-48.726.23-3.801,2.419-1.382,2.419-1.382Z"
              data-title="Left Adductor Short"
              onClick={(e) => handleAreaClick('path-94', e)}
            />
            </g>
          </g>
        </g>
      </g>
    </svg>
  )

  const backBodySVG = (
    <svg 
      width="400" 
      height="600" 
      viewBox="0 0 595.276 841.89" 
      xmlns="http://www.w3.org/2000/svg"
      className="max-w-full h-auto"
    >
      <defs>
        <style>
          {`
            .body-area { cursor: pointer; transition: opacity 0.2s; }
            .body-area:hover { opacity: 0.7; }
            .cls-1 { fill: #707070; }
            .cls-2 { fill: #bebdbe; }
            .cls-3 { fill: #3f3f3f; }
          `}
        </style>
      </defs>
      
      {/* Back Body - Individual Muscle Regions */}
      <g>
        <g id="_Слой_1" data-name="Слой_1">
          <g id="Anterior_Body">
            {/* Main Body Outline - Non-clickable background */}
            <path 
              id="back-main-body-bg"
              fill="#f3f4f6"
              stroke="#d1d5db" 
              strokeWidth="1"
              d="M503.606,431.387c-1.159-1.217-7.362-5.217-8.869-6.783-1.507-1.565-1.507-2.783-5.681-9.971-4.174-7.188-19.739-13.565-21.478-13.913-1.739-.348-5.13-4.609-6-6.957-3.586-9.681-12-42.782-15.652-72.348-3.652-29.565-17.391-46.261-24.87-56.522.348-28.348-6.154-34.253-9.739-43.304.348-7.13,2.824-22.625,1.151-42.995-1.325-16.135-21.499-35.381-34.02-37.12-8.109-1.126-12.58.812-23.072,0-10.493-.812-30.145-18.435-31.188-20.522-1.043-2.087-3.246-19.478-1.623-21.681,1.623-2.203,1.855-.116,3.478-4.638,1.623-4.522.748-12.652.748-12.652,0,0,.431-1.734.73-.537.174.696.522,1.42,1.304,1.826,1.215.63,2.726-2.299,4.319-5.072,4.236-7.376,8.204-21.448,2.348-23.217-1.066-.322-2.609,2.435-2.609,2.435,0-1.391,1.391-14.261-.696-22.261-1.672-6.408-7.929-12.814-12.87-16.696-6.035-4.741-18.342-5.076-21.407-5.099v-.002c-.063,0-.176,0-.272,0-.096,0-.209,0-.272,0v.002c-3.065.024-15.372.358-21.407,5.099-4.94,3.881-11.198,10.288-12.869,16.696-2.087,8-.696,20.869-.696,22.261,0,0-1.543-2.757-2.609-2.435-5.856,1.769-1.888,15.842,2.348,23.217,1.593,2.773,3.104,5.702,4.319,5.072.783-.406,1.13-1.13,1.304-1.826.299-1.198.73.537.73.537,0,0-.875,8.13.748,12.652,1.623,4.522,1.855,2.435,3.478,4.638,1.623,2.203-.58,19.594-1.623,21.681-1.043,2.087-20.695,19.71-31.188,20.522-10.493.812-14.963-1.126-23.072,0-12.522,1.739-32.696,20.985-34.021,37.12-1.673,20.37.803,35.865,1.151,42.995-3.586,9.052-10.087,14.956-9.739,43.304-7.478,10.261-21.217,26.956-24.869,56.522-3.652,29.565-12.066,62.666-15.652,72.348-.87,2.348-4.261,6.609-6,6.957-1.739.348-17.304,6.725-21.478,13.913-4.174,7.188-4.174,8.406-5.681,9.971-1.507,1.565-7.71,5.565-8.869,6.783-1.159,1.217-1.971,5.797,1.275,6.551,3.246.754,11.928-1.13,14.754-7.478,3.391-2.217,4.217-2.261,4.217-2.261,0,0,1.145,3.478.971,6.261-.174,2.783-5.884,11.304-8.145,16.348-2.261,5.044-9.043,14.348-7.217,16.957,1.826,2.609,4.435,2.174,5.565,1.304,1.131-.87,7.565-11.782,8.826-13.696,1.435-1.87,6.826-8.826,7.783-9.87-1.536,6.348-4.029,13.826-5.015,16.783-.985,2.957-5.581,11.857-5.623,14.899-.058,4.232,2.863,5.169,4.812,3.884,5.449-3.594,8.509-12.803,9.855-15.478,2.279-4.529,4.754-12.58,7.072-16.29-.58,4.522-1.995,10.753-2.754,16.029-.384,2.668-2.723,16.404.261,17.304,4.609,1.391,5.217-3.913,7.043-10.174,1.826-6.261,4.087-21.739,5.478-24.087,2.087.435,1.773,1.909,2.174,6.087.526,5.487.087,19.13,4.087,19.13s4.29-13.739,4.812-22.087c.522-8.348,3.246-12.754,4.638-19.594,1.391-6.841,4.632-16.343,4.406-24.348-.105-3.717-1.681-7.014,1.507-18.898,1.956-7.292,26.551-55.42,29.316-59.942,2.996-4.897,8.597-19.478,9.988-30.609,1.391-11.13,1.159-11.594,1.855-16.928.696-5.333,2.853-7.684,5.565-10.898,3.13-3.71,7.652-14.725,11.13-29.739,1.623-.058,2.12-1.399,2.898-.87,0,0,2.087,23.768,6.377,30.377,4.29,6.609,3.014,9.043,3.942,11.478.928,2.435.464,18.319-.232,27.13-.696,8.812-2.725,39.536-4.638,46.84-1.913,7.304-4.29,10.435-6.145,19.71-1.855,9.275-4.812,21.416-5.449,32.812,0,0-3.897,27.041-3.536,37.217.387,10.903-2.435,85.043,13.217,103.13-.754,3.536-.058,9.681.058,11.536.116,1.855-4.406,21.101-2.667,33.971,1.739,12.87,1.043,8.406.696,11.623-.348,3.217-14.261,46.348,6.609,125.768,1.247,4.746,1.739,14.319,1.739,19.362s-1.739,14.956-1.739,19.652-.174,6.956.869,9.913c1.044,2.956.87,7.826.174,11.478-.696,3.652-14.783,13.565-16,18.956-1.217,5.391-2.782,8.522-.522,10.087,2.261,1.565,3.304,0,3.304,0,0,0-.869,2.609.522,4,1.391,1.391,5.565,1.217,5.565,1.217,0,0,1.391.348,2.261,1.739.87,1.391,4.522,2.087,5.391,1.217.869-.87,1.391-.798,2.087.383.376.639,1.922,1.39,3.263,1.946,1.289.534,2.752.418,3.94-.313l2.71-1.668s2.261,2.609,2.783,2.783c.522.174,5.913,2.087,7.304,0,1.391-2.087,8-7.13,7.652-13.043-.348-5.913-.869-9.217-.696-11.304.174-2.087.696-5.217,1.565-8.348.87-3.13,1.913-4.522,1.217-10.435-.696-5.913-.174-6.261-.174-7.304s.869-3.826,1.043-6.956-2.261-9.565-2.261-9.565c0,0-1.044-6.261-1.565-14.783-.522-8.522,1.217-42.087,4.696-53.217,3.478-11.13,5.519-14.615,5.913-17.391,4.174-29.391-2.605-61.037-3.826-72.232-.696-6.377,2.087-7.072,3.826-13.507,1.739-6.435,3.13-22.435,1.217-29.565-1.404-5.231,4.869-24.348,5.739-30.261.87-5.913,12.812-51.652,13.449-59.826.638-8.174,1.449-33.526-.696-37.353,1.021,0,3.948,2.031,5.195,2.385.054.046.145.055.253.047.108.008.199,0,.253-.047,1.247-.354,4.174-2.385,5.195-2.385-2.145,3.826-1.333,29.179-.696,37.353.638,8.174,12.58,53.913,13.449,59.826.87,5.913,7.143,25.029,5.739,30.261-1.913,7.13-.522,23.13,1.217,29.565,1.739,6.435,4.522,7.13,3.826,13.507-1.221,11.194-8,42.84-3.826,72.232.394,2.776,2.435,6.261,5.913,17.391,3.478,11.13,5.217,44.696,4.696,53.217-.522,8.522-1.565,14.783-1.565,14.783,0,0-2.435,6.435-2.261,9.565.174,3.13,1.044,5.913,1.044,6.956s.522,1.391-.174,7.304c-.696,5.913.348,7.304,1.217,10.435.87,3.13,1.391,6.261,1.565,8.348.174,2.087-.348,5.391-.696,11.304-.348,5.913,6.261,10.956,7.652,13.043,1.391,2.087,6.783.174,7.304,0,.522-.174,2.783-2.783,2.783-2.783l2.71,1.668c1.188.731,2.652.847,3.94.313,1.341-.555,2.887-1.306,3.263-1.946.696-1.182,1.217-1.253,2.087-.383.87.869,4.522.174,5.391-1.217.87-1.391,2.261-1.739,2.261-1.739,0,0,4.174.174,5.565-1.217,1.391-1.391.522-4,.522-4,0,0,1.043,1.565,3.304,0,2.261-1.565.696-4.696-.522-10.087-1.217-5.391-15.304-15.304-16-18.956-.696-3.652-.87-8.522.174-11.478,1.043-2.957.87-5.217.87-9.913s-1.739-14.609-1.739-19.652.492-14.616,1.739-19.362c20.869-79.42,6.956-122.55,6.609-125.768-.348-3.217-1.044,1.246.696-11.623,1.739-12.87-2.783-32.116-2.667-33.971.116-1.855.812-8,.058-11.536,15.652-18.087,12.831-92.228,13.217-103.13.361-10.176-3.536-37.217-3.536-37.217-.637-11.395-3.594-23.536-5.449-32.812-1.855-9.275-4.232-12.406-6.145-19.71-1.913-7.304-3.942-38.029-4.638-46.84-.696-8.812-1.159-24.696-.232-27.13.927-2.435-.348-4.87,3.942-11.478,4.29-6.609,6.377-30.377,6.377-30.377.779-.529,1.275.812,2.898.87,3.478,15.015,8,26.029,11.13,29.739,2.713,3.215,4.87,5.565,5.565,10.898.696,5.333.464,5.797,1.855,16.928,1.391,11.13,6.992,25.711,9.988,30.609,2.766,4.522,27.36,52.65,29.316,59.942,3.188,11.884,1.612,15.182,1.507,18.898-.226,8.004,3.015,17.507,4.406,24.348,1.391,6.841,4.116,11.246,4.638,19.594.522,8.348.812,22.087,4.812,22.087s3.561-13.644,4.087-19.13c.401-4.178.087-5.652,2.174-6.087,1.391,2.348,3.652,17.826,5.478,24.087,1.826,6.261,2.435,11.565,7.044,10.174,2.984-.901.645-14.636.261-17.304-.759-5.275-2.174-11.507-2.754-16.029,2.319,3.71,4.793,11.761,7.073,16.29,1.346,2.675,4.406,11.884,9.855,15.478,1.948,1.285,4.87.348,4.812-3.884-.042-3.041-4.638-11.942-5.623-14.899-.986-2.956-3.478-10.435-5.015-16.783.957,1.044,6.348,8,7.783,9.87,1.261,1.913,7.696,12.826,8.826,13.696,1.13.87,3.739,1.304,5.565-1.304,1.826-2.609-4.957-11.913-7.217-16.957-2.261-5.043-7.971-13.565-8.145-16.348-.174-2.783.971-6.261.971-6.261,0,0,.826.043,4.217,2.261,2.826,6.348,11.507,8.232,14.754,7.478,3.246-.754,2.435-5.333,1.275-6.551Z"
            />
            
            {/* Back Head */}
            <path 
              id="back-head"
              className="body-area"
              fill={getAreaColor('back-head')}
              stroke="#374151" 
              strokeWidth="1"
              d="M320.678,13.36c-7.409-2.663-14.377-5.072-23.109-4.323-.047.004-.09.063-.132.114-.043-.051-.085-.11-.132-.114-8.732-.75-15.7,1.66-23.109,4.323-11.508,4.136-14.944,19.574-14.705,30.713,0,4.599,1.194,9.169,2.209,13.622,1.04,4.563,3.065,4.535,3.853,4.796,12.087,4,12.849,19.784,18.174,20,3.798.154,8.116-.025,11.954-.01.128.033.253.074.394.068.439-.021.9-.033,1.362-.044.462.011.923.023,1.362.044.141.007.266-.035.394-.068,3.838-.014,8.157.164,11.954.01,5.325-.216,6.087-16,18.174-20,.788-.261,2.813-.233,3.853-4.796,1.015-4.453,2.209-9.023,2.209-13.622.239-11.138-3.197-26.577-14.705-30.713Z"
              data-title="Back Head" onClick={(e) => handleAreaClick('back-head', e)}
            />
            
            {/* Left Gluteus Maximus */}
            <path 
              id="left-gluteus-maximus"
              className="body-area"
              fill={getAreaColor('left-gluteus-maximus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M253.837,372.924c-12.632,7.536-19.747,12.87-24.023,19.826-4.276,6.957-3.478,19.478,2.319,32,5.797,12.522,17.855,26.553,24.116,26.553s16.522,7.949,27.13,3.881c9.211-3.532,5.642-9.896,6.586-18.222,1.316-11.61,4.197-10.937,5.762-38.473.377-6.629-1.13-17.681-2.985-21.391-1.855-3.71-5.653-8.464-7.276-10.551-1.623-2.087-2.667-6.672-16.232-.696-5.618,2.475-7.317,2.251-15.397,7.072Z"
              data-title="Left Gluteus Maximus" onClick={(e) => handleAreaClick('left-gluteus-maximus', e)}
            />
            
            {/* Right Gluteus Maximus */}
            <path 
              id="right-gluteus-maximus"
              className="body-area"
              fill={getAreaColor('right-gluteus-maximus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M341.037,372.924c12.632,7.536,19.747,12.87,24.023,19.826,4.276,6.957,3.478,19.478-2.319,32-5.797,12.522-17.855,26.553-24.116,26.553s-16.522,7.949-27.13,3.881c-9.211-3.532-5.642-9.896-6.586-18.222-1.316-11.61-4.197-10.937-5.762-38.473-.377-6.629,1.13-17.681,2.985-21.391,1.855-3.71,5.653-8.464,7.276-10.551,1.623-2.087,2.667-6.672,16.232-.696,5.618,2.475,7.317,2.251,15.397,7.072Z"
              data-title="Right Gluteus Maximus" onClick={(e) => handleAreaClick('right-gluteus-maximus', e)}
            />
            
            {/* Left Back Trap */}
            <path 
              id="left-back-trap"
              className="body-area"
              fill={getAreaColor('left-back-trap')}
              stroke="#374151" 
              strokeWidth="1"
              d="M244.075,144.055c6.261,6.609,13.348,32.585,17.391,46.261,4.659,15.76,8.02,25.471,20.174,45.217,8.172,13.277,7.652,21.913,9.391,20.522,2.435-26.783,8-99.826-1.391-107.478-9.391-7.652-12.522-6.261-22.956-7.652-10.435-1.391-22.609,3.13-22.609,3.13Z"
              data-title="Left Back Trap" onClick={(e) => handleAreaClick('left-back-trap', e)}
            />
            
            {/* Right Back Trap */}
            <path 
              id="right-back-trap"
              className="body-area"
              fill={getAreaColor('right-back-trap')}
              stroke="#374151" 
              strokeWidth="1"
              d="M350.799,144.055c-6.261,6.609-13.348,32.585-17.391,46.261-4.659,15.76-8.02,25.471-20.174,45.217-8.172,13.277-7.652,21.913-9.391,20.522-2.435-26.783-8-99.826,1.391-107.478,9.391-7.652,12.522-6.261,22.956-7.652,10.435-1.391,22.609,3.13,22.609,3.13Z"
              data-title="Right Back Trap" onClick={(e) => handleAreaClick('right-back-trap', e)}
            />
            
            {/* Left Infraspinatus */}
            <path 
              id="left-infraspinatus"
              className="body-area"
              fill={getAreaColor('left-infraspinatus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M220.833,168.517c7.328-4.045,14.941-7.604,22.742-10.637.836-.325,1.71-.649,2.603-.567,4.097.376,5.892,13.106,6.631,16.049,2.362,9.412,4.67,18.832,7.613,28.085,3.585,11.27-13.071,1.742-16.348,0-5.333-2.836-10.468-4.953-14.887-9.297-5.305-5.215-7.939-12.12-10.962-18.753-1.02-2.238-1.452-2.573.79-3.857.603-.345,1.209-.686,1.817-1.022Z"
              data-title="Left Infraspinatus" onClick={(e) => handleAreaClick('left-infraspinatus', e)}
            />
            
            {/* Right Infraspinatus */}
            <path 
              id="right-infraspinatus"
              className="body-area"
              fill={getAreaColor('right-infraspinatus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M374.041,168.517c-7.328-4.045-14.941-7.604-22.742-10.637-.836-.325-1.71-.649-2.603-.567-4.097.376-5.893,13.106-6.631,16.049-2.362,9.412-4.67,18.832-7.613,28.085-3.585,11.27,13.071,1.742,16.348,0,5.333-2.836,10.468-4.953,14.887-9.297,5.305-5.215,7.939-12.12,10.962-18.753,1.02-2.238,1.452-2.573-.79-3.857-.603-.345-1.209-.686-1.817-1.022Z"
              data-title="Right Infraspinatus" onClick={(e) => handleAreaClick('right-infraspinatus', e)}
            />
            
            {/* Left Triceps */}
            <path 
              id="left-triceps"
              className="body-area"
              fill={getAreaColor('left-triceps')}
              stroke="#374151" 
              strokeWidth="1"
              d="M209.64,195.881c-23.529,16.696-23.188,27.362-21.101,41.044,1.899,12.452,7.513-1.015,11.278-3.787,2.741-2.018,5.519-3.951,8.215-6.033.884-.683,6.115-3.894,5.935-5.252-.153-1.159-4.327-25.971-4.327-25.971Z"
              data-title="Left Triceps" onClick={(e) => handleAreaClick('left-triceps', e)}
            />
            
            {/* Right Triceps */}
            <path 
              id="right-triceps"
              className="body-area"
              fill={getAreaColor('right-triceps')}
              stroke="#374151" 
              strokeWidth="1"
              d="M385.234,195.881c23.529,16.696,23.188,27.362,21.101,41.044-1.899,12.452-7.513-1.015-11.278-3.787-2.741-2.018-5.519-3.951-8.215-6.033-.884-.683-6.115-3.894-5.935-5.252.153-1.159,4.327-25.971,4.327-25.971Z"
              data-title="Right Triceps" onClick={(e) => handleAreaClick('right-triceps', e)}
            />
            
            {/* Left Latissimus Dorsi */}
            <path 
              id="left-latissimus-dorsi"
              className="body-area"
              fill={getAreaColor('left-latissimus-dorsi')}
              stroke="#374151" 
              strokeWidth="1"
              d="M264.132,208.867c3.71,6.857,11.594,25.871,14.377,31.205s6.956,7.42,6.029,12.985c-.928,5.565-8.398,25.839-11.594,32.563-3.196,6.725-7.884,20.406-10.435,26.567-2.721,6.573-5.101,13.681-6.261,17.159-.939,2.816-9.936-10.028-13.326-15.017-.844-1.242-1.419-2.638-1.691-4.115-.926-5.038-3.255-17.88-5.158-29.795-1.102-6.904-3.246-9.739-5.101-25.043-1.855-15.304-.928-12.754-5.565-20.638-4.638-7.884-5.797-18.087-4.87-18.319,6.261,4.638,12.927,4.531,17.519,5.333,1.245.218,5.143.775,9.843-.803,7.797-2.618,8.995-3.943,10.618-6.958,1.623-3.014,5.614-5.125,5.614-5.125Z"
              onClick={(e) => handleAreaClick('left-latissimus-dorsi', e)}
            />
            
            {/* Right Latissimus Dorsi */}
            <path 
              id="right-latissimus-dorsi"
              className="body-area"
              fill={getAreaColor('right-latissimus-dorsi')}
              stroke="#374151" 
              strokeWidth="1"
              d="M330.741,208.867c-3.71,6.857-11.594,25.871-14.377,31.205s-6.956,7.42-6.029,12.985c.928,5.565,8.398,25.839,11.594,32.563,3.196,6.725,7.884,20.406,10.435,26.567,2.721,6.573,5.101,13.681,6.261,17.159.939,2.816,9.936-10.028,13.326-15.017.844-1.242,1.419-2.638,1.691-4.115.926-5.038,3.255-17.88,5.158-29.795,1.102-6.904,3.246-9.739,5.101-25.043,1.855-15.304.928-12.754,5.565-20.638,4.638-7.884,5.797-18.087,4.87-18.319-6.261,4.638-12.927,4.531-17.519,5.333-1.245.218-5.143.775-9.843-.803-7.797-2.618-8.995-3.943-10.618-6.958-1.623-3.014-5.614-5.125-5.614-5.125Z"
              onClick={(e) => handleAreaClick('right-latissimus-dorsi', e)}
            />
            
            {/* Left Hamstring */}
            <path 
              id="left-hamstring"
              className="body-area"
              fill={getAreaColor('left-hamstring')}
              stroke="#374151" 
              strokeWidth="1"
              d="M232.202,565.967c-2.407,11.809-3.78,32.696-4.939,33.623,9.971-10.667,21.05-49.935,23.652-63.072,2.57-12.973,2.609-55.681,3.768-62.637,1.159-6.957-.091-6.444-1.169-10.174-1.566-5.422-7.941-14.228-11.22-17.507-12.522-12.522-2.742,83.706-10.092,119.768Z"
              onClick={(e) => handleAreaClick('left-hamstring', e)}
            />
            
            {/* Right Hamstring */}
            <path 
              id="right-hamstring"
              className="body-area"
              fill={getAreaColor('right-hamstring')}
              stroke="#374151" 
              strokeWidth="1"
              d="M362.671,565.967c2.407,11.809,3.78,32.696,4.939,33.623-9.971-10.667-21.05-49.935-23.652-63.072-2.57-12.973-2.609-55.681-3.768-62.637-1.159-6.957.091-6.444,1.169-10.174,1.566-5.422,7.941-14.228,11.22-17.507,12.522-12.522,2.742,83.706,10.092,119.768Z"
              onClick={(e) => handleAreaClick('right-hamstring', e)}
            />
            
            {/* Left Foot */}
            <path 
              id="left-foot"
              className="body-area"
              fill={getAreaColor('left-foot')}
              stroke="#374151" 
              strokeWidth="1"
              d="M219.843,814.778c3.478,0,36.174-.696,37.333,2.087,1.159,2.783,4.962,9.507-2.041,9.507s-26.249-3.246-29.727-4.638-7.652-4.87-7.652-4.87l2.087-2.087Z"
              data-title="Left Foot" onClick={(e) => handleAreaClick('left-foot', e)}
            />
            
            {/* Right Foot */}
            <path 
              id="right-foot"
              className="body-area"
              fill={getAreaColor('right-foot')}
              stroke="#374151" 
              strokeWidth="1"
              d="M375.849,814.778c-3.478,0-36.174-.696-37.333,2.087-1.159,2.783-4.962,9.507,2.041,9.507s26.249-3.246,29.727-4.638,7.652-4.87,7.652-4.87l-2.087-2.087Z"
              data-title="Right Foot" onClick={(e) => handleAreaClick('right-foot', e)}
            />
            
            {/* Left Back Shoulder */}
            <path 
              id="left-back-shoulder"
              className="body-area"
              fill={getAreaColor('left-back-shoulder')}
              stroke="#374151" 
              strokeWidth="1"
              d="M228.12,154.019c-2.314-1.484-5.519-3.253-5.992-3.414-3.499-1.196-7.343-1.411-10.978-.791-5.958,1.015-12.054,5.984-16.504,9.892-2.883,2.533-5.59,7.041-7.003,10.61-2.185,5.518-1.35,10.159-1.339,15.949.013,6.847.027,13.694.04,20.541,0,.053,7.168-2.876,7.836-3.25,3.727-2.084,7.016-4.805,10.163-7.672,2.754-2.508,6.456-5.927,6.456-9.974,0-6.099,1.432-12.257,4.734-17.435,3.713-5.824,9.841-8.162,14.975-12.443.244-.204-.883-1.048-2.387-2.012Z"
              data-title="Left Back Shoulder" onClick={(e) => handleAreaClick('left-back-shoulder', e)}
            />
            
            {/* Right Back Shoulder */}
            <path 
              id="right-back-shoulder"
              className="body-area"
              fill={getAreaColor('right-back-shoulder')}
              stroke="#374151" 
              strokeWidth="1"
              d="M366.753,154.019c2.314-1.484,5.519-3.253,5.992-3.414,3.499-1.196,7.343-1.411,10.978-.791,5.958,1.015,12.054,5.984,16.504,9.892,2.883,2.533,5.59,7.041,7.003,10.61,2.184,5.518,1.35,10.159,1.339,15.949-.013,6.847-.027,13.694-.04,20.541,0,.053-7.168-2.876-7.836-3.25-3.727-2.084-7.016-4.805-10.163-7.672-2.754-2.508-6.456-5.927-6.456-9.974,0-6.099-1.432-12.257-4.734-17.435-3.713-5.824-9.841-8.162-14.975-12.443-.244-.204.883-1.048,2.387-2.012Z"
              data-title="Right Back Shoulder" onClick={(e) => handleAreaClick('right-back-shoulder', e)}
            />
            
            {/* Left Teres Major */}
            <path 
              id="left-teres-major"
              className="body-area"
              fill={getAreaColor('left-teres-major')}
              stroke="#374151" 
              strokeWidth="1"
              d="M220.554,187.465c.173.365.326.663.456.856,2.219,3.272,5.07,6.089,8.189,8.502,5.628,4.355,12.478,8.799,19.571,9.956,4.087.667,5.522,1.145,6.609,1.754,1.087.609-.956,2.435-.956,2.652s-6.29,3.594-13.015,4.406c-9.996,1.206-20.162-3.186-24.729-12.417-1.728-3.492-2.594-7.366-2.79-11.245-.163-3.209-.818-6.83,1.364-9.56,2.152-2.692,4.159,2.678,5.302,5.096Z"
              data-title="Left Teres Major" onClick={(e) => handleAreaClick('left-teres-major', e)}
            />
            
            {/* Right Teres Major */}
            <path 
              id="right-teres-major"
              className="body-area"
              fill={getAreaColor('right-teres-major')}
              stroke="#374151" 
              strokeWidth="1"
              d="M374.32,187.465c-.173.365-.326.663-.456.856-2.219,3.272-5.07,6.089-8.189,8.502-5.628,4.355-12.478,8.799-19.571,9.956-4.087.667-5.522,1.145-6.609,1.754-1.087.609.956,2.435.956,2.652s6.29,3.594,13.015,4.406c9.996,1.206,20.162-3.186,24.729-12.417,1.728-3.492,2.594-7.366,2.79-11.245.163-3.209.818-6.83-1.364-9.56-2.152-2.692-4.159,2.678-5.302,5.096Z"
              data-title="Right Teres Major" onClick={(e) => handleAreaClick('right-teres-major', e)}
            />
            
            {/* Left Back Hip */}
            <path 
              id="left-back-hip"
              className="body-area"
              fill={getAreaColor('left-back-hip')}
              stroke="#374151" 
              strokeWidth="1"
              d="M241.39,318.744c.64.189,1.222.625,1.82,1.293,2.455,2.74,4.732,5.64,6.812,8.675,1.955,2.853,4.592,6.216,5.357,9.658.615,2.767-7.689,6.491-9.404,7.593-4.189,2.692-7.769,5.919-10.312,10.256-1.513,2.581-2.04,1.091-2.371-1.035-.993-6.386-1.766-13.129-1.22-19.696.46-5.539,1.264-14.201,7.094-16.53.855-.342,1.57-.407,2.224-.214Z"
              data-title="Left Back Hip" onClick={(e) => handleAreaClick('left-back-hip', e)}
            />
            
            {/* Right Back Hip */}
            <path 
              id="right-back-hip"
              className="body-area"
              fill={getAreaColor('right-back-hip')}
              stroke="#374151" 
              strokeWidth="1"
              d="M353.484,318.744c-.64.189-1.222.625-1.82,1.293-2.455,2.74-4.732,5.64-6.812,8.675-1.955,2.853-4.592,6.216-5.357,9.658-.615,2.767,7.689,6.491,9.404,7.593,4.189,2.692,7.769,5.919,10.312,10.256,1.513,2.581,2.04,1.091,2.371-1.035.993-6.386,1.766-13.129,1.22-19.696-.46-5.539-1.264-14.201-7.094-16.53-.855-.342-1.57-.407-2.224-.214Z"
              data-title="Right Back Hip" onClick={(e) => handleAreaClick('right-back-hip', e)}
            />
            
            {/* Left Adductor Back */}
            <path 
              id="left-adductor-back"
              className="body-area"
              fill={getAreaColor('left-adductor-back')}
              stroke="#374151" 
              strokeWidth="1"
              d="M268.132,462.199c4.174,3.71,15.838,24.24,12.128,44.182s5.757-12.766,7.872-25.573c1.673-10.125,2.715-17.855.812-19.536-2.987-2.639-20.811.928-20.811.928Z"
              data-title="Left Adductor Back" onClick={(e) => handleAreaClick('left-adductor-back', e)}
            />
            
            {/* Right Adductor Back */}
            <path 
              id="right-adductor-back"
              className="body-area"
              fill={getAreaColor('right-adductor-back')}
              stroke="#374151" 
              strokeWidth="1"
              d="M326.741,462.199c-4.174,3.71-15.838,24.24-12.128,44.182s-5.757-12.766-7.872-25.573c-1.673-10.125-2.715-17.855-.812-19.536,2.987-2.639,20.811.928,20.811.928Z"
              data-title="Right Adductor Back" onClick={(e) => handleAreaClick('right-adductor-back', e)}
            />
            
            {/* Left Vastus Lateralis Quad */}
            <path 
              id="left-vastus-lateralis-quad"
              className="body-area"
              fill={getAreaColor('left-vastus-lateralis-quad')}
              stroke="#374151" 
              strokeWidth="1"
              d="M217.988,438.663c-1.391,9.044,1.855,77.449,7.188,98.087,5.333,20.638,4.122,8.116,2.989-2.087-1.134-10.203,2.113-36.406,2.576-45.681.464-9.275-1.391-32.232-5.333-42.203-3.942-9.971-3.246-10.435-5.565-13.913-2.319-3.478-1.855,5.797-1.855,5.797Z"
              data-title="Left Vastus Lateralis Quad" onClick={(e) => handleAreaClick('left-vastus-lateralis-quad', e)}
            />
            
            {/* Right Vastus Lateralis Quad */}
            <path 
              id="right-vastus-lateralis-quad"
              className="body-area"
              fill={getAreaColor('right-vastus-lateralis-quad')}
              stroke="#374151" 
              strokeWidth="1"
              d="M376.886,438.663c1.391,9.044-1.855,77.449-7.188,98.087-5.333,20.638-4.122,8.116-2.989-2.087,1.134-10.203-2.113-36.406-2.576-45.681-.464-9.275,1.391-32.232,5.333-42.203,3.942-9.971,3.246-10.435,5.565-13.913,2.319-3.478,1.855,5.797,1.855,5.797Z"
              data-title="Right Vastus Lateralis Quad" onClick={(e) => handleAreaClick('right-vastus-lateralis-quad', e)}
            />
            
            {/* Left BFlh */}
            <path 
              id="left-bflh"
              className="body-area"
              fill={getAreaColor('left-bflh')}
              stroke="#374151" 
              strokeWidth="1"
              d="M232.202,565.967c-2.407,11.809-3.78,32.696-4.939,33.623,9.971-10.667,21.05-49.935,23.652-63.072,2.57-12.973,2.609-55.681,3.768-62.637,1.159-6.957-.091-6.444-1.169-10.174-1.566-5.422-7.941-14.228-11.22-17.507-12.522-12.522-2.742,83.706-10.092,119.768Z"
              data-title="Left BFlh" onClick={(e) => handleAreaClick('left-bflh', e)}
            />
            
            {/* Right BFlh */}
            <path 
              id="right-bflh"
              className="body-area"
              fill={getAreaColor('right-bflh')}
              stroke="#374151" 
              strokeWidth="1"
              d="M362.671,565.967c2.407,11.809,3.78,32.696,4.939,33.623-9.971-10.667-21.05-49.935-23.652-63.072-2.57-12.973-2.609-55.681-3.768-62.637-1.159-6.957.091-6.444,1.169-10.174,1.566-5.422,7.941-14.228,11.22-17.507,12.522-12.522,2.742,83.706,10.092,119.768Z"
              data-title="Right BFlh" onClick={(e) => handleAreaClick('right-bflh', e)}
            />
            
            {/* Left Semimembranosus */}
            <path 
              id="left-semimembranosus"
              className="body-area"
              fill={getAreaColor('left-semimembranosus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M276.886,506.605c0,12.29-11.13,44.29-10.435,58.666.696,14.377-2.213,39.42-2.677,41.507,4.87-11.362,7.186-35.942,7.417-48,.232-12.058,8.245-32.927,7.317-39.884s-1.623-12.29-1.623-12.29Z"
              data-title="Left Semimembranosus" onClick={(e) => handleAreaClick('left-semimembranosus', e)}
            />
            
            {/* Right Semimembranosus */}
            <path 
              id="right-semimembranosus"
              className="body-area"
              fill={getAreaColor('right-semimembranosus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M317.988,506.605c0,12.29,11.13,44.29,10.435,58.666-.696,14.377,2.213,39.42,2.677,41.507-4.87-11.362-7.186-35.942-7.417-48-.232-12.058-8.245-32.927-7.317-39.884.928-6.956,1.623-12.29,1.623-12.29Z"
              data-title="Right Semimembranosus" onClick={(e) => handleAreaClick('right-semimembranosus', e)}
            />
            
            {/* Left Lateral Gastrocs */}
            <path 
              id="left-lateral-gastrocs"
              className="body-area"
              fill={getAreaColor('left-lateral-gastrocs')}
              stroke="#374151" 
              strokeWidth="1"
              d="M236.77,594.836c-18.783,21.913-14.089,75.594-10.959,89.855,3.13,14.261,3.538,16.763,10.106,16.672,2.576-.036,8.389-3.687,7.345-15.513-1.043-11.826.232-44.606.232-57.739,0-7.652,2.087-44.938,2.087-44.938l-8.812,11.662Z"
              data-title="Left Lateral Gastrocs" onClick={(e) => handleAreaClick('left-lateral-gastrocs', e)}
            />
            
            {/* Right Lateral Gastrocs */}
            <path 
              id="right-lateral-gastrocs"
              className="body-area"
              fill={getAreaColor('right-lateral-gastrocs')}
              stroke="#374151" 
              strokeWidth="1"
              d="M358.103,594.836c18.783,21.913,14.089,75.594,10.959,89.855-3.13,14.261-3.538,16.763-10.106,16.672-2.576-.036-8.389-3.687-7.345-15.513,1.043-11.826-.232-44.606-.232-57.739,0-7.652-2.087-44.938-2.087-44.938l8.812,11.662Z"
              data-title="Right Lateral Gastrocs" onClick={(e) => handleAreaClick('right-lateral-gastrocs', e)}
            />
            
            {/* Left Medial Gastrocs */}
            <path 
              id="left-medial-gastrocs"
              className="body-area"
              fill={getAreaColor('left-medial-gastrocs')}
              stroke="#374151" 
              strokeWidth="1"
              d="M248.984,610.257c2.599,27.13.541,60.965,0,71.188-.515,9.739-1.005,18.993,3.633,19.921,4.638.928,15.806-13.834,17.893-27.399,1.659-10.781-1.246-33.792-3.13-44-2.67-14.462-6.001-19.71-9.609-27.13s-7.029-15.768-7.637-19.246c-.609-3.478-1.149,26.667-1.149,26.667Z"
              data-title="Left Medial Gastrocs" onClick={(e) => handleAreaClick('left-medial-gastrocs', e)}
            />
            
            {/* Right Medial Gastrocs */}
            <path 
              id="right-medial-gastrocs"
              className="body-area"
              fill={getAreaColor('right-medial-gastrocs')}
              stroke="#374151" 
              strokeWidth="1"
              d="M345.89,610.257c-2.599,27.13-.541,60.965,0,71.188.515,9.739,1.005,18.993-3.633,19.921-4.638.928-15.806-13.834-17.893-27.399-1.659-10.781,1.246-33.792,3.13-44,2.67-14.462,6.001-19.71,9.609-27.13,3.608-7.42,7.029-15.768,7.637-19.246.609-3.478,1.149,26.667,1.149,26.667Z"
              data-title="Right Medial Gastrocs" onClick={(e) => handleAreaClick('right-medial-gastrocs', e)}
            />
            
            {/* Left Heel */}
            <path 
              id="left-heel"
              className="body-area"
              fill={getAreaColor('left-heel')}
              stroke="#374151" 
              strokeWidth="1"
              d="M238.282,780.633c2.551,11.362,1.95,16.491,6.841,17.507,8.927,1.855,10.667-5.333,11.13-10.899.464-5.565,3.015-7.884,3.015-7.884,0,0-.086,20.64-1.159,25.739-.928,4.406-.882,7.065-5.639,7.065-6.689,0-11.468,1.109-14.767.007-3.733-1.247-2.268-16.77-2.783-24-.594-8.348-.984-10.027-.52-12.114.464-2.087,3.883,4.578,3.883,4.578Z"
              data-title="Left Heel" onClick={(e) => handleAreaClick('left-heel', e)}
            />
            
            {/* Right Heel */}
            <path 
              id="right-heel"
              className="body-area"
              fill={getAreaColor('right-heel')}
              stroke="#374151" 
              strokeWidth="1"
              d="M356.591,780.633c-2.551,11.362-1.95,16.491-6.841,17.507-8.927,1.855-10.667-5.333-11.13-10.899-.464-5.565-3.015-7.884-3.015-7.884,0,0,.086,20.64,1.159,25.739.928,4.406.882,7.065,5.639,7.065,6.689,0,11.468,1.109,14.767.007,3.733-1.247,2.268-16.77,2.783-24,.594-8.348.984-10.027.52-12.114-.464-2.087-3.883,4.578-3.883,4.578Z"
              data-title="Right Heel" onClick={(e) => handleAreaClick('right-heel', e)}
            />
            
            {/* Left Achilles */}
            <path 
              id="left-achilles"
              className="body-area"
              fill={getAreaColor('left-achilles')}
              stroke="#374151" 
              strokeWidth="1"
              d="M236.958,708.231c3.152.079,5.772,2.478,6.162,5.607,2.243,17.996,4.037,62.548,3.621,65.461-.464,3.246-2.038,18.523-3.478,11.538-4.232-20.523-6.751-50.291-9.275-62.61-2.435-11.884-6.725-14.782-2.087-18.492,2.366-1.893,1.947-1.582,5.057-1.503Z"
              data-title="Left Achilles" onClick={(e) => handleAreaClick('left-achilles', e)}
            />
            
            {/* Right Achilles */}
            <path 
              id="right-achilles"
              className="body-area"
              fill={getAreaColor('right-achilles')}
              stroke="#374151" 
              strokeWidth="1"
              d="M357.916,708.231c-3.152.079-5.772,2.478-6.162,5.607-2.243,17.996-4.037,62.548-3.621,65.461.464,3.246,2.038,18.523,3.478,11.538,4.232-20.523,6.751-50.291,9.275-62.61,2.435-11.884,6.725-14.782,2.087-18.492-2.366-1.893-1.947-1.582-5.057-1.503Z"
              data-title="Right Achilles" onClick={(e) => handleAreaClick('right-achilles', e)}
            />
            
            {/* Left Semitendinosus */}
            <path 
              id="left-semitendinosus"
              className="body-area"
              fill={getAreaColor('left-semitendinosus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M259.519,472.324c-2.194,9.469-10.941,111.725-2.194,123.092,3.71-6.261,6.431-60.985,14.901-83.014,4.397-11.437-.348-26.319-2.413-34.203-.67-2.558-7.304-13.333-7.304-13.333l-2.99,7.459Z"
              data-title="Left Semitendinosus" onClick={(e) => handleAreaClick('left-semitendinosus', e)}
            />
            
            {/* Right Semitendinosus */}
            <path 
              id="right-semitendinosus"
              className="body-area"
              fill={getAreaColor('right-semitendinosus')}
              stroke="#374151" 
              strokeWidth="1"
              d="M335.354,472.324c2.194,9.469,10.941,111.725,2.194,123.092-3.71-6.261-6.431-60.985-14.901-83.014-4.397-11.437.348-26.319,2.413-34.203.67-2.558,7.304-13.333,7.304-13.333l2.99,7.459Z"
              data-title="Right Semitendinosus" onClick={(e) => handleAreaClick('right-semitendinosus', e)}
            />
            
            {/* Left Elbow */}
            <path 
              id="left-elbow"
              className="body-area"
              fill={getAreaColor('left-elbow')}
              stroke="#374151" 
              strokeWidth="1"
              d="M172.471,289.082c.279,3.064.799,6.101.856,9.216.11,5.972-1.907,18.422,3.761,22.676,5.021-4.754,7.043-13.133,6.656-19.817-.222-3.833-3.835-6.377-6.195-9.149-1.787-2.099-3.538-4.231-5.253-6.389,0,1.161.071,2.314.175,3.462Z"
              data-title="Left Elbow" onClick={(e) => handleAreaClick('left-elbow', e)}
            />
            
            {/* Right Elbow */}
            <path 
              id="right-elbow"
              className="body-area"
              fill={getAreaColor('right-elbow')}
              stroke="#374151" 
              strokeWidth="1"
              d="M422.403,289.082c-.279,3.064-.799,6.101-.856,9.216-.11,5.972,1.907,18.422-3.76,22.676-5.021-4.754-7.043-13.133-6.656-19.817.222-3.833,3.835-6.377,6.195-9.149,1.787-2.099,3.538-4.231,5.253-6.389,0,1.161-.071,2.314-.175,3.462Z"
              data-title="Right Elbow" onClick={(e) => handleAreaClick('right-elbow', e)}
            />
            
            {/* Left Back Forearm */}
            <path 
              id="left-back-forearm"
              className="body-area"
              fill={getAreaColor('left-back-forearm')}
              stroke="#374151" 
              strokeWidth="1"
              d="M162.799,295.823c-1.855,15.536-10.667,85.681-16.464,100.753-.464,7.188,21.826-36.956,24.435-51.652,2.069-11.653-1.478-34.261-4.029-39.826-2.551-5.565-3.942-9.275-3.942-9.275Z"
              data-title="Left Back Forearm" onClick={(e) => handleAreaClick('left-back-forearm', e)}
            />
            
            {/* Right Back Forearm */}
            <path 
              id="right-back-forearm"
              className="body-area"
              fill={getAreaColor('right-back-forearm')}
              stroke="#374151" 
              strokeWidth="1"
              d="M432.074,295.823c1.855,15.536,10.667,85.681,16.464,100.753.464,7.188-21.826-36.956-24.435-51.652-2.069-11.653,1.478-34.261,4.029-39.826,2.551-5.565,3.942-9.275,3.942-9.275Z"
              data-title="Right Back Forearm" onClick={(e) => handleAreaClick('right-back-forearm', e)}
            />
            
            {/* Left Gluteus Medius */}
            <path 
              id="left-gluteus-medius"
              className="body-area"
              fill={getAreaColor('left-gluteus-medius')}
              stroke="#374151" 
              strokeWidth="1"
              d="M272.48,356.808c-3.71-2.087-21.29-7.424-28.29-3.478-6.377,3.594-15.536,24.294-15.072,31.42,7.582-4.638,22.319-16.759,29.043-19.478,6.725-2.719,17.101-5.449,17.101-5.449l-2.783-3.015Z"
              data-title="Left Gluteus Medius" onClick={(e) => handleAreaClick('left-gluteus-medius', e)}
            />
            
            {/* Right Gluteus Medius */}
            <path 
              id="right-gluteus-medius"
              className="body-area"
              fill={getAreaColor('right-gluteus-medius')}
              stroke="#374151" 
              strokeWidth="1"
              d="M322.393,356.808c3.71-2.087,21.29-7.424,28.29-3.478,6.377,3.594,15.536,24.294,15.072,31.42-7.582-4.638-22.319-16.759-29.043-19.478-6.725-2.719-17.101-5.449-17.101-5.449l2.783-3.015Z"
              data-title="Right Gluteus Medius" onClick={(e) => handleAreaClick('right-gluteus-medius', e)}
            />
            
            {/* Left Lower Back */}
            <path 
              id="left-lower-back"
              className="body-area"
              fill={getAreaColor('left-lower-back')}
              stroke="#374151" 
              strokeWidth="1"
              d="M287.785,265.678c-.905-1.863-2.319,3.246-5.101,8.116-2.783,4.87-12.522,28.058-14.377,33.159-.9,2.474-14.493,35.188-10.493,37.797,11.61,7.572,31.826,20.522,31.826,20.522,6.029-23.536,2.087-91.478-1.855-99.594Z"
              data-title="Left Lower Back" onClick={(e) => handleAreaClick('left-lower-back', e)}
            />
            
            {/* Right Lower Back */}
            <path 
              id="right-lower-back"
              className="body-area"
              fill={getAreaColor('right-lower-back')}
              stroke="#374151" 
              strokeWidth="1"
              d="M307.089,265.678c.905-1.863,2.319,3.246,5.101,8.116,2.783,4.87,12.522,28.058,14.377,33.159.9,2.474,14.493,35.188,10.493,37.797-11.61,7.572-31.826,20.522-31.826,20.522-6.029-23.536-2.087-91.478,1.855-99.594Z"
              data-title="Right Lower Back" onClick={(e) => handleAreaClick('right-lower-back', e)}
            />
            
            {/* Left Back Upper Trap */}
            <path 
              id="left-back-upper-trap"
              className="body-area"
              fill={getAreaColor('left-back-upper-trap')}
              stroke="#374151" 
              strokeWidth="1"
              d="M281.204,91.25c-.697,1.318-.474,3.161-.374,4.865.223,3.813-.746,8.474-1.277,12.288-.69,4.953-2.997,11.471-5.391,15.826-2.165,3.938-4.628,3.957-8.464,6.398-2.309,1.469-3.34,1.524-5.664,2.965-.508.315-3.073,1.79-2.814,2.511.233.65,3.94.75,4.629.826,6.817.756,13.692.512,20.531.268,2.062-.074,4.123-.147,6.185-.221.899-.032,1.851-.08,2.598-.581,1.299-.87,1.456-2.686,1.483-4.249.228-13.355.456-24.778.684-38.133.02-1.146-.001-2.408-.759-3.269-.492-.559-1.219-.849-1.934-1.057-2.403-.701-5.007-.696-7.407.013-1.034.305-1.657.854-2.025,1.55Z"
              data-title="Left Back Upper Trap" onClick={(e) => handleAreaClick('left-back-upper-trap', e)}
            />
            
            {/* Right Back Upper Trap */}
            <path 
              id="right-back-upper-trap"
              className="body-area"
              fill={getAreaColor('right-back-upper-trap')}
              stroke="#374151" 
              strokeWidth="1"
              d="M313.67,91.25c.697,1.318.473,3.161.374,4.865-.223,3.813.746,8.474,1.277,12.288.69,4.953,2.997,11.471,5.391,15.826,2.165,3.938,4.628,3.957,8.464,6.398,2.309,1.469,3.339,1.524,5.663,2.965.508.315,3.073,1.79,2.814,2.511-.233.65-3.94.75-4.629.826-6.817.756-13.692.512-20.531.268-2.062-.074-4.123-.147-6.185-.221-.899-.032-1.851-.08-2.598-.581-1.299-.87-1.456-2.686-1.483-4.249-.228-13.355-.456-24.778-.684-38.133-.02-1.146.001-2.408.759-3.269.492-.559,1.219-.849,1.934-1.057,2.403-.701,5.007-.696,7.407.013,1.034.305,1.657.854,2.025,1.55Z"
              data-title="Right Back Upper Trap" onClick={(e) => handleAreaClick('right-back-upper-trap', e)}
            />
            
            {/* Left Back Hand */}
            <path 
              id="left-back-hand"
              className="body-area"
              fill={getAreaColor('left-back-hand')}
              stroke="#374151" 
              strokeWidth="1"
              d="M136.742,400.519c.958-.166,1.924-.209,2.894-.094,5.524.654,15.15,1.767,17.344,8.014.255.725.274,1.509.281,2.278.074,8.143-.916,16.313-3.012,24.185-.394,1.479-.853,2.972-1.73,4.227-4.945,7.078-18.275,2.266-23.853-1.265-5.038-3.19-12.612-8.127-12.961-14.608-.311-5.761,3.136-11.945,7.775-15.235,3.8-2.694,8.43-6.664,13.261-7.502Z"
              data-title="Left Back Hand" onClick={(e) => handleAreaClick('left-back-hand', e)}
            />
            
            {/* Right Back Hand */}
            <path 
              id="right-back-hand"
              className="body-area"
              fill={getAreaColor('right-back-hand')}
              stroke="#374151" 
              strokeWidth="1"
              d="M458.131,400.519c-.958-.166-1.924-.209-2.894-.094-5.524.654-15.15,1.767-17.344,8.014-.255.725-.274,1.509-.281,2.278-.074,8.143.915,16.313,3.012,24.185.394,1.479.853,2.972,1.73,4.227,4.945,7.078,18.275,2.266,23.853-1.265,5.038-3.19,12.612-8.127,12.961-14.608.311-5.761-3.136-11.945-7.775-15.235-3.8-2.694-8.43-6.664-13.261-7.502Z"
              data-title="Right Back Hand" onClick={(e) => handleAreaClick('right-back-hand', e)}
            />
            
            {/* Left Back 1st Finger */}
            <path 
              id="left-back-1st-finger"
              className="body-area"
              fill={getAreaColor('left-back-1st-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M113.718,410.837c-2.899,2.783-7.652,8.214-9.623,12.339-1.971,4.125-10.435,5.748-10.551,8.299-.116,2.551-.696,4.174.464,4.29,1.159.116,5.565.348,8.232-2.087,2.667-2.435,4.638-3.826,6.377-6.261,1.739-2.435,3.246-5.333,4.058-9.159.812-3.826,3.13-9.159,3.13-9.159l-2.087,1.739Z"
              data-title="Left Back 1st Finger" onClick={(e) => handleAreaClick('left-back-1st-finger', e)}
            />
            
            {/* Right Back 1st Finger */}
            <path 
              id="right-back-1st-finger"
              className="body-area"
              fill={getAreaColor('right-back-1st-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M481.156,410.837c2.899,2.783,7.652,8.214,9.623,12.339,1.971,4.125,10.435,5.748,10.551,8.299.116,2.551.696,4.174-.464,4.29-1.159.116-5.565.348-8.232-2.087s-4.638-3.826-6.377-6.261c-1.739-2.435-3.246-5.333-4.058-9.159-.812-3.826-3.13-9.159-3.13-9.159l2.087,1.739Z"
              data-title="Right Back 1st Finger" onClick={(e) => handleAreaClick('right-back-1st-finger', e)}
            />
            
            {/* Left Back 2nd Finger */}
            <path 
              id="left-back-2nd-finger"
              className="body-area"
              fill={getAreaColor('left-back-2nd-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M115.041,434.913c-1.638,1.374-5.094,9.189-5.698,10.306-1.735,3.207-3.466,6.417-5.196,9.627-1.397,2.593-4.135,5.992-4.458,8.978-.098.735-.777,4.788,1.025,3.967.27-.123.476-.351.672-.574,4.755-5.389,8.45-11.373,12.532-17.253,1.197-1.724,2.336-3.491,3.605-5.165,1.093-1.442,2.964-2.784,3.827-4.327.375-.67.329-1.487.273-2.253-.02-.275-.044-.562-.19-.796-.134-.216-.355-.36-.572-.492-1.649-1.01-3.456-1.76-5.335-2.216-.133-.032-.297.041-.486.199Z"
              data-title="Left Back 2nd Finger" onClick={(e) => handleAreaClick('left-back-2nd-finger', e)}
            />
            
            {/* Right Back 2nd Finger */}
            <path 
              id="right-back-2nd-finger"
              className="body-area"
              fill={getAreaColor('right-back-2nd-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M479.832,434.913c1.638,1.374,5.094,9.189,5.698,10.306,1.735,3.207,3.466,6.417,5.196,9.627,1.397,2.593,4.135,5.992,4.458,8.978.098.735.777,4.788-1.025,3.967-.27-.123-.476-.351-.672-.574-4.755-5.389-8.45-11.373-12.532-17.253-1.197-1.724-2.336-3.491-3.605-5.165-1.093-1.442-2.964-2.784-3.827-4.327-.375-.67-.329-1.487-.273-2.253.02-.275.044-.562.19-.796.134-.216.355-.36.572-.492,1.649-1.01,3.456-1.76,5.335-2.216.133-.032.297.041.486.199Z"
              data-title="Right Back 2nd Finger" onClick={(e) => handleAreaClick('right-back-2nd-finger', e)}
            />
            
            {/* Left Back 3rd Finger */}
            <path 
              id="left-back-3rd-finger"
              className="body-area"
              fill={getAreaColor('left-back-3rd-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M123.062,442.351c-.921.956-1.541,4.469-1.833,5.344-.8,2.395-1.65,4.773-2.526,7.141-1.721,4.65-3.545,9.26-5.305,13.895-1.174,3.091-2.714,6.074-2.673,9.466.022,1.812,2.264.917,3.212.468,3.037-1.437,3.422-3.824,4.563-6.638.882-2.177,1.786-4.344,2.696-6.509,2.823-6.712,5.686-13.397,8.905-19.931.12-.243.242-.493.27-.764.246-2.404-5.405-2.659-6.825-2.714-.17-.007-.332.082-.485.241Z"
              data-title="Left Back 3rd Finger" onClick={(e) => handleAreaClick('left-back-3rd-finger', e)}
            />
            
            {/* Right Back 3rd Finger */}
            <path 
              id="right-back-3rd-finger"
              className="body-area"
              fill={getAreaColor('right-back-3rd-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M471.812,442.351c.921.956,1.541,4.469,1.833,5.344.8,2.395,1.65,4.773,2.526,7.141,1.721,4.65,3.545,9.26,5.305,13.895,1.174,3.091,2.714,6.074,2.673,9.466-.022,1.812-2.264.917-3.212.468-3.037-1.437-3.422-3.824-4.563-6.638-.882-2.177-1.786-4.344-2.696-6.509-2.823-6.712-5.686-13.397-8.905-19.931-.12-.243-.242-.493-.27-.764-.246-2.404,5.405-2.659,6.825-2.714.17-.007.332.082.485.241Z"
              data-title="Right Back 3rd Finger" onClick={(e) => handleAreaClick('right-back-3rd-finger', e)}
            />
            
            {/* Left Back 4th Finger */}
            <path 
              id="left-back-4th-finger"
              className="body-area"
              fill={getAreaColor('left-back-4th-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M133.253,445.205c-1.533,6.433-2.068,13.164-3.161,19.689-.357,2.134-.717,4.268-1.049,6.407-.439,2.829-.922,5.164-.606,8.074.029.27.069.557.244.765.805.96,2.72-.017,3.31-.748.65-.806.914-1.853,1.08-2.875.463-2.844,1.137-5.652,1.712-8.479.871-4.285,1.69-8.581,2.557-12.867.532-2.633,1.065-5.267,1.597-7.9.065-.32.127-.668-.015-.963-.289-.603-5.654-1.166-5.67-1.103Z"
              data-title="Left Back 4th Finger" onClick={(e) => handleAreaClick('left-back-4th-finger', e)}
            />
            
            {/* Right Back 4th Finger */}
            <path 
              id="right-back-4th-finger"
              className="body-area"
              fill={getAreaColor('right-back-4th-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M461.62,445.205c1.533,6.433,2.068,13.164,3.161,19.689.357,2.134.717,4.268,1.049,6.407.439,2.829.922,5.164.606,8.074-.029.27-.069.557-.244.765-.805.96-2.72-.017-3.31-.748-.65-.806-.914-1.853-1.08-2.875-.463-2.844-1.137-5.652-1.712-8.479-.871-4.285-1.69-8.581-2.557-12.867-.532-2.633-1.065-5.267-1.597-7.9-.065-.32-.127-.668.015-.963.289-.603,5.654-1.166,5.67-1.103Z"
              data-title="Right Back 4th Finger" onClick={(e) => handleAreaClick('right-back-4th-finger', e)}
            />
            
            {/* Left Back 5th Finger */}
            <path 
              id="left-back-5th-finger"
              className="body-area"
              fill={getAreaColor('left-back-5th-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M144.801,445.505c-.067,3.683-.118,7.371-.094,11.055.022,2.369.092,4.742.33,7.101.198,1.962.245,5.602,1.483,7.147.736.919,2.812-4.742,2.881-5.085.322-1.606.265-21.571,1.135-21.671-1.939.224-3.896.81-5.735,1.453Z"
              data-title="Left Back 5th Finger" onClick={(e) => handleAreaClick('left-back-5th-finger', e)}
            />
            
            {/* Right Back 5th Finger */}
            <path 
              id="right-back-5th-finger"
              className="body-area"
              fill={getAreaColor('right-back-5th-finger')}
              stroke="#374151" 
              strokeWidth="1"
              d="M450.073,445.505c.067,3.683.118,7.371.094,11.055-.022,2.369-.092,4.742-.33,7.101-.198,1.962-.245,5.602-1.483,7.147-.736.919-2.812-4.742-2.881-5.085-.322-1.606-.265-21.571-1.135-21.671,1.939.224,3.896.81,5.735,1.453Z"
              data-title="Right Back 5th Finger" onClick={(e) => handleAreaClick('right-back-5th-finger', e)}
            />
            
            {/* Additional Left Triceps (Second Region) */}
            <path 
              id="left-triceps-2"
              className="body-area"
              fill={getAreaColor('left-triceps-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M213.117,226.838c-4.727,3.957-9.376,8.043-13.78,12.359-4.417,4.329-5.341,7.454-5.418,13.765-.112,9.102-2.838,17.876-4.197,26.816-.69,4.539-1.052,9.165-.461,13.737.696,5.385,1.734,2.783,4.136.164,1.215-1.324,2.411-2.669,3.528-4.078,3.445-4.345,3.5-8.108,4.194-13.547.76-5.959,5.327-8.132,8-13.565,1.67-3.395,2.589-10.714,4.259-14.109,3.471-7.055,4.411-15.118,2.002-22.587,0,0-2.261,1.044-2.262,1.044Z"
              onClick={(e) => handleAreaClick('left-triceps-2', e)}
            />
            
            {/* Additional Right Triceps (Second Region) */}
            <path 
              id="right-triceps-2"
              className="body-area"
              fill={getAreaColor('right-triceps-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M381.756,226.838c4.727,3.957,9.376,8.043,13.78,12.359,4.417,4.329,5.341,7.454,5.418,13.765.111,9.102,2.838,17.876,4.197,26.816.69,4.539,1.052,9.165.461,13.737-.696,5.385-1.734,2.783-4.136.164-1.215-1.324-2.411-2.669-3.528-4.078-3.445-4.345-3.5-8.108-4.194-13.547-.76-5.959-5.327-8.132-8-13.565-1.67-3.395-2.589-10.714-4.259-14.109-3.471-7.055-4.411-15.118-2.002-22.587,0,0,2.261,1.044,2.262,1.044Z"
              onClick={(e) => handleAreaClick('right-triceps-2', e)}
            />
            
            {/* Additional Left Triceps (Third Region) */}
            <path 
              id="left-triceps-3"
              className="body-area"
              fill={getAreaColor('left-triceps-3')}
              stroke="#374151" 
              strokeWidth="1"
              d="M182.683,233.794c-3.015,8.33-8.522,35.826-5.97,47.656.598,2.77,2.768,8.757,4.722,3.119,3.071-8.861,6.942-17.766,9.113-26.902,1.429-6.015-4.212-16.394-7.865-23.872Z"
              onClick={(e) => handleAreaClick('left-triceps-3', e)}
            />
            
            {/* Additional Right Triceps (Third Region) */}
            <path 
              id="right-triceps-3"
              className="body-area"
              fill={getAreaColor('right-triceps-3')}
              stroke="#374151" 
              strokeWidth="1"
              d="M412.19,233.794c3.014,8.33,8.522,35.826,5.97,47.656-.598,2.77-2.768,8.757-4.722,3.119-3.071-8.861-6.942-17.766-9.113-26.902-1.429-6.015,4.212-16.394,7.865-23.872Z"
              onClick={(e) => handleAreaClick('right-triceps-3', e)}
            />
            
            {/* Additional Left Back Forearm (Second Region) */}
            <path 
              id="left-back-forearm-2"
              className="body-area"
              fill={getAreaColor('left-back-forearm-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M187.031,310.895c-2.203,1.739-3.445,4.596-3.551,4.872-10.444,27.25-14.699,48.311-27.174,72.461-.833,1.612-2.448,6.131-4.406,6.718,6.956-2.087,17.739-32.053,31.434-55.945,2.975-5.19,11.348-26.018,12.044-28.802.525-2.106-6.507-.758-8.348.696Z"
              onClick={(e) => handleAreaClick('left-back-forearm-2', e)}
            />
            
            {/* Additional Right Back Forearm (Second Region) */}
            <path 
              id="right-back-forearm-2"
              className="body-area"
              fill={getAreaColor('right-back-forearm-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M407.842,310.895c2.203,1.739,3.445,4.596,3.551,4.872,10.444,27.25,14.699,48.311,27.174,72.461.833,1.612,2.448,6.131,4.406,6.718-6.956-2.087-17.739-32.053-31.434-55.945-2.975-5.19-11.348-26.018-12.044-28.802-.525-2.106,6.507-.758,8.348.696Z"
              onClick={(e) => handleAreaClick('right-back-forearm-2', e)}
            />
            
            {/* Additional Left Back Forearm (Third Region) */}
            <path 
              id="left-back-forearm-3"
              className="body-area"
              fill={getAreaColor('left-back-forearm-3')}
              stroke="#374151" 
              strokeWidth="1"
              d="M154.741,310.779c-3.478,14.377-8.065,59.188-18.266,85.797,8.348-5.565,13.454-25.391,14.846-33.507,2.948-17.196,5.305-36.139,6.477-53.521.116-1.716.161-4.821-1.886-5.355-.991,1.952-.848,4.444-1.171,6.586Z"
              onClick={(e) => handleAreaClick('left-back-forearm-3', e)}
            />
            
            {/* Additional Right Back Forearm (Third Region) */}
            <path 
              id="right-back-forearm-3"
              className="body-area"
              fill={getAreaColor('right-back-forearm-3')}
              stroke="#374151" 
              strokeWidth="1"
              d="M440.132,310.779c3.478,14.377,8.065,59.188,18.266,85.797-8.348-5.565-13.454-25.391-14.846-33.507-2.948-17.196-5.305-36.139-6.477-53.521-.116-1.716-.161-4.821,1.886-5.355.991,1.952.848,4.444,1.171,6.586Z"
              onClick={(e) => handleAreaClick('right-back-forearm-3', e)}
            />
            
            {/* Additional Left Achilles (Second Region) */}
            <path 
              id="left-achilles-2"
              className="body-area"
              fill={getAreaColor('left-achilles-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M250.673,710.662c-3.871,4.406.248,81.989.938,82.038.696.049,2.551-24.995,6.029-39.371s3.609-37.97,3.594-38.029c-1.401-5.559-7.652-6.629-10.561-4.638Z"
              onClick={(e) => handleAreaClick('left-achilles-2', e)}
            />
            
            {/* Additional Right Achilles (Second Region) */}
            <path 
              id="right-achilles-2"
              className="body-area"
              fill={getAreaColor('right-achilles-2')}
              stroke="#374151" 
              strokeWidth="1"
              d="M344.201,710.662c3.871,4.406-.248,81.989-.938,82.038-.696.049-2.551-24.995-6.029-39.371-3.478-14.377-3.609-37.97-3.594-38.029,1.401-5.559,7.652-6.629,10.561-4.638Z"
              onClick={(e) => handleAreaClick('right-achilles-2', e)}
            />
          </g>
        </g>
      </g>
    </svg>
  )

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900 overflow-y-auto w-full h-full"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999
      }}
    >
      <div className="min-h-screen w-full h-full flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 p-2 sm:p-4 border-b border-slate-600">
          <div className="flex justify-between items-center mb-2 sm:mb-3">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              data-title="Close body map"
            >
              <X className="h-4 w-4 sm:h-6 sm:w-6" />
            </button>
            <div className="flex-1"></div> {/* Spacer */}
            <button
              onClick={onContinue}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors text-xs sm:text-sm"
            >
              Continue
            </button>
          </div>
          
          {/* Front/Back Toggle */}
          <div className="flex justify-center mb-2 sm:mb-3">
            <div className="bg-slate-700 rounded-lg p-1 flex">
              <button
                onClick={() => onViewChange('front')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  view === 'front' 
                    ? 'bg-slate-600 text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Front
              </button>
              <button
                onClick={() => onViewChange('back')}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  view === 'back' 
                    ? 'bg-slate-600 text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Back
              </button>
            </div>
          </div>
          
          <p className="text-xs sm:text-sm text-slate-300 text-center">
            Click on body areas to cycle through pain/soreness levels (1-10)
          </p>
        </div>
        
        {/* Main Content - Mobile optimized layout */}
        <div className="flex-1 flex flex-col gap-2 sm:gap-4 p-2 sm:p-4">
          {/* Selected Areas Card - Fixed height with internal scroll */}
          <div className="bg-slate-800 rounded-lg p-2 sm:p-4 flex flex-col" style={{ height: typeof window !== 'undefined' && window.innerWidth < 768 ? '25vh' : '30vh' }}>
            <h5 className="text-sm sm:text-base font-medium text-slate-300 mb-2 sm:mb-3 text-center flex-shrink-0">Selected Areas:</h5>
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              {Object.keys(selectedAreas).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {Object.entries(selectedAreas).map(([area, rating]) => (
                    <div key={area} className="bg-slate-700/50 rounded-lg p-1.5 sm:p-2 flex items-center justify-between min-h-[2.5rem] sm:min-h-[3rem]">
                      <div className="flex items-center space-x-0.5 sm:space-x-1 flex-1 min-w-0">
                        <div 
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-white flex-shrink-0"
                          style={{ backgroundColor: getColorForRating(rating) }}
                        ></div>
                        <span className="text-white capitalize text-xs sm:text-xs font-medium truncate" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{getMuscleName(area)}</span>
                      </div>
                      <div className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
                        <span className="font-bold text-white text-xs sm:text-xs" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{rating}/10</span>
                        <button
                          type="button"
                          onClick={() => handleDeselectArea(area)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 sm:p-1.5 rounded transition-colors flex-shrink-0"
                          data-title="Remove this area"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-sm py-4 sm:py-8">
                  No areas selected yet
                </div>
              )}
            </div>
          </div>
          
          {/* Body Map Card - Smaller white background */}
          <div className="flex-1 bg-white rounded-lg p-2 sm:p-4 relative overflow-hidden" style={{ minHeight: typeof window !== 'undefined' && window.innerWidth < 768 ? '35vh' : '45vh' }}>
            {/* Zoom Controls */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-2">
              <button
                onClick={() => setScale(Math.min(scale * 1.2, 3))}
                className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold shadow-lg"
              >
                +
              </button>
              <button
                onClick={() => setScale(Math.max(scale * 0.8, 0.5))}
                className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold shadow-lg"
              >
                -
              </button>
              <button
                onClick={resetZoom}
                className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
              >
                ⌂
              </button>
            </div>
            
            {/* SVG Container with Zoom and Pan */}
            <div 
              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'pan-y' }}
            >
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              >
                {view === 'front' ? frontBodySVG : backBodySVG}
              </div>
            </div>
          </div>
        </div>
        
      </div>
      
    </div>
  )
}