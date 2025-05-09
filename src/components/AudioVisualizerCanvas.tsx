import React, { useRef, useEffect, useCallback } from "react"
import styled from "styled-components"

// 상수 정의
const DIGITAL_RAIN_CHARS =
  "0123456789ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ"

// 스타일 정의
const CanvasContainer = styled.div`
  width: 90vw;
  max-width: 1200px;
  position: relative;
  margin-bottom: 30px;

  &::before {
    content: "";
    display: block;
    padding-top: 56.25%; /* 16:9 비율 */
  }
`

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  box-shadow: 0 0 30px rgba(74, 0, 224, 0.5), 0 0 60px rgba(0, 242, 255, 0.3);
  border: 1px solid rgba(0, 242, 255, 0.2);
  transform: translateZ(0); /* 하드웨어 가속 활성화 */
  will-change: transform; /* 성능 최적화 힌트 */
`

// 파티클 인터페이스
interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  color: string
  life: number
  maxLife: number
}

// 디지털 비 인터페이스
interface DigitalRain {
  x: number
  y: number
  baseSpeed: number
  speedVariation: number
  speedPattern: number
  currentSpeed: number
  speed: number
  length: number
  characters: { char: string; brightness: number }[]
  opacity: number
}

interface AudioVisualizerCanvasProps {
  analyser: AnalyserNode | null
  dataArray: Uint8Array | null
  timeDomainArray: Uint8Array | null
  isListening: boolean
}

const AudioVisualizerCanvas: React.FC<AudioVisualizerCanvasProps> = ({
  analyser,
  dataArray,
  timeDomainArray,
  isListening,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameIdRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const digitalRainRef = useRef<DigitalRain[]>([])

  // 성능 최적화를 위한 변수들
  const lastFrameTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const fpsRef = useRef<number>(60)
  const isLowPerformanceRef = useRef<boolean>(false)

  // 디지털 비 초기화 함수
  const initializeDigitalRain = useCallback((width: number, height: number) => {
    const columns = Math.floor(width / 15) // 간격을 20px에서 15px로 줄임
    digitalRainRef.current = Array.from({ length: columns }, (_, i) => {
      const baseSpeed = 0.1 + Math.random() * 0.8
      const speedVariation = 0.1 + Math.random() * 0.3
      const speedPattern = Math.random() > 0.5 ? 1 : -1

      return {
        x: i * 15 - width / 2, // x 좌표 계산 수정
        y: -height / 2,
        baseSpeed,
        speedVariation,
        speedPattern,
        currentSpeed: baseSpeed,
        speed: baseSpeed,
        length: 5 + Math.floor(Math.random() * 15),
        characters: Array.from({ length: 20 }, () => {
          return {
            char: DIGITAL_RAIN_CHARS[
              Math.floor(Math.random() * DIGITAL_RAIN_CHARS.length)
            ],
            brightness: Math.random() * 0.5 + 0.5,
          }
        }),
        opacity: 0.3 + Math.random() * 0.7,
      }
    })
  }, [])

  const drawInitialCanvas = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.fillStyle = "rgba(10, 10, 20, 0.95)"
      context.fillRect(-width / 2, -height / 2, width, height)
      context.font =
        "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      context.fillStyle = "rgba(0, 200, 255, 0.6)"
      context.textAlign = "center"
      context.fillText("SYSTEM STANDBY", 0, -20)
      context.font =
        "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      context.fillStyle = "rgba(150, 150, 180, 0.5)"
      context.fillText("PRESS START TO ENGAGE AUDIO ANALYSIS", 0, 20)
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const context = canvas.getContext("2d")
      if (context) {
        context.scale(dpr, dpr)
        context.translate(rect.width / 2, rect.height / 2)
        initializeDigitalRain(rect.width, rect.height)
        context.fillStyle = "rgba(10, 10, 20, 0.95)"
        context.fillRect(
          -rect.width / 2,
          -rect.height / 2,
          rect.width,
          rect.height
        )
        drawInitialCanvas(context, rect.width, rect.height)
      }
    }
  }, [drawInitialCanvas, initializeDigitalRain])

  // 파티클 생성 함수
  const createParticle = useCallback(
    (x: number, y: number, energy: number, baseColor: string) => {
      const size = Math.random() * 3 + 1 + energy * 0.05
      const speedFactor = 1 + energy * 0.02
      const particle: Particle = {
        x,
        y,
        size,
        speedX: (Math.random() - 0.5) * (2 * speedFactor),
        speedY: (Math.random() - 0.5) * (2 * speedFactor) - energy * 0.01,
        color: baseColor,
        life: 100 + Math.random() * 50 + energy,
        maxLife: 100 + Math.random() * 50 + energy,
      }
      particlesRef.current.push(particle)
      if (particlesRef.current.length > 200) {
        particlesRef.current.shift()
      }
    },
    []
  )

  // 파티클 업데이트 및 그리기
  const drawParticles = useCallback(
    (context: CanvasRenderingContext2D, deltaTime: number) => {
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.x += p.speedX * (deltaTime / 16)
        p.y += p.speedY * (deltaTime / 16)
        p.life -= 1.5 * (deltaTime / 16)

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1)
          continue
        }

        const opacity = (p.life / p.maxLife) * 0.8
        context.beginPath()
        context.arc(
          p.x,
          p.y,
          p.size * (p.life / p.maxLife),
          0,
          Math.PI * 2,
          false
        )
        context.fillStyle = `${p.color.slice(0, -2)}${opacity})`
        context.fill()
      }
    },
    []
  )

  // 성능 모니터링 함수
  const monitorPerformance = useCallback((currentTime: number) => {
    frameCountRef.current++
    if (currentTime - lastFrameTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current
      frameCountRef.current = 0
      lastFrameTimeRef.current = currentTime

      // FPS가 30 이하면 저성능 모드로 전환
      isLowPerformanceRef.current = fpsRef.current < 30
    }
  }, [])

  // 디지털 비 그리기 함수
  const drawDigitalRain = useCallback(
    (context: CanvasRenderingContext2D, height: number, energy: number) => {
      if (isLowPerformanceRef.current) {
        // 저성능 모드에서는 디지털 비 간소화 (2개 중 1개만 표시)
        const reducedRain = digitalRainRef.current.filter((_, i) => i % 2 === 0)
        digitalRainRef.current = reducedRain
      }

      context.font =
        "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

      const energyThreshold = 0.01
      const effectiveEnergy = Math.max(
        0,
        (energy - energyThreshold) / (1 - energyThreshold)
      )

      digitalRainRef.current.forEach((rain) => {
        rain.currentSpeed += rain.speedVariation * rain.speedPattern * 0.005

        if (
          rain.currentSpeed < rain.baseSpeed * 0.7 ||
          rain.currentSpeed > rain.baseSpeed * 1.3
        ) {
          rain.speedPattern *= -1
        }

        const energyMultiplier =
          energy > energyThreshold
            ? 1 + effectiveEnergy * 0.5 * (0.2 + Math.random() * 0.8)
            : 1
        const speed = rain.currentSpeed * energyMultiplier
        const baseOpacity = rain.opacity * (0.5 + effectiveEnergy * 0.6)

        for (let i = 0; i < rain.length; i++) {
          const y = rain.y + i * 18
          if (y > height / 2) continue

          const changeProbability = Math.min(1, energy * 2)

          if (Math.random() < changeProbability) {
            const brightness = 0.4 + effectiveEnergy * 0.7 + Math.random() * 0.3
            rain.characters[i % rain.characters.length] = {
              char: DIGITAL_RAIN_CHARS[
                Math.floor(Math.random() * DIGITAL_RAIN_CHARS.length)
              ],
              brightness: Math.min(1, brightness),
            }
          }

          const { char, brightness } =
            rain.characters[i % rain.characters.length]
          const fadeRatio = 1 - i / rain.length
          const charOpacity = baseOpacity * fadeRatio * brightness

          const hue =
            energy > energyThreshold ? 120 + effectiveEnergy * 60 : 120
          const saturation = 100 - (i / rain.length) * 30
          const lightness =
            energy > energyThreshold
              ? 50 + effectiveEnergy * 25 + (i / rain.length) * 20
              : 50 + (i / rain.length) * 20

          context.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${
            charOpacity * 0.5
          })`
          context.shadowBlur = 4 + brightness * 4
          context.shadowOffsetX = 0
          context.shadowOffsetY = 0

          context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${charOpacity})`
          context.fillText(char, rain.x, y)

          if (i === 0) {
            context.shadowBlur = 8 + brightness * 8
            context.fillStyle = `hsla(${hue}, ${saturation}%, ${
              lightness + 20
            }%, ${charOpacity})`
            context.fillText(char, rain.x, y)
          }
        }

        context.shadowColor = "transparent"
        context.shadowBlur = 0
        context.shadowOffsetX = 0
        context.shadowOffsetY = 0

        rain.y += speed
        if (rain.y > height / 2) {
          rain.y = -height / 2
          rain.characters = Array.from({ length: 20 }, () => {
            return {
              char: DIGITAL_RAIN_CHARS[
                Math.floor(Math.random() * DIGITAL_RAIN_CHARS.length)
              ],
              brightness: Math.random() * 0.5 + 0.5,
            }
          })
        }
      })
    },
    []
  )

  const draw = useCallback(
    (timestamp: number) => {
      if (!analyser || !canvasRef.current || !dataArray || !timeDomainArray) {
        if (isListening) {
          animationFrameIdRef.current = requestAnimationFrame(draw)
        }
        return
      }

      // 성능 모니터링
      monitorPerformance(timestamp)

      const lastTime = animationFrameIdRef.current
        ? animationFrameIdRef.current / 1000
        : 0
      const currentTime = timestamp / 1000
      const deltaTime = (currentTime - lastTime) * 1000 || 16.67

      const canvas = canvasRef.current
      const context = canvas.getContext("2d", { alpha: false }) // 알파 채널 비활성화로 성능 향상
      if (!context) return

      // 하드웨어 가속 활성화
      context.imageSmoothingEnabled = false

      const bufferLength = analyser.frequencyBinCount
      const freqData = dataArray
      const timeData = timeDomainArray

      analyser.getByteFrequencyData(freqData)
      analyser.getByteTimeDomainData(timeData)

      const width = canvas.width
      const height = canvas.height
      const centerX = 0
      const centerY = 0

      // 배경 그라데이션
      const gradient = context.createRadialGradient(
        centerX + Math.sin(timestamp / 5000) * 50,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(width, height) / 2
      )
      gradient.addColorStop(
        0,
        `rgba(20, 30, 50, ${0.5 + Math.sin(timestamp / 2000) * 0.2})`
      )
      gradient.addColorStop(1, "rgba(9, 10, 15, 0.9)")
      context.fillStyle = gradient
      context.fillRect(-width / 2, -height / 2, width, height)

      // 파티클 그리기
      drawParticles(context, deltaTime)

      // 에너지 계산
      const bassEnergy =
        (freqData[0] + freqData[1] + freqData[2] + freqData[3] + freqData[4]) /
        5 /
        255
      const midEnergy =
        freqData.slice(100, 300).reduce((s, v) => s + v, 0) / (200 * 255)
      const overallEnergy =
        freqData.reduce((s, v) => s + v, 0) / (bufferLength * 255)

      // 중앙 맥동 구체
      const coreRadius = 35 + bassEnergy * 60 + overallEnergy * 20
      const coreX = centerX + Math.sin(timestamp / 5000) * (coreRadius * 0.5)
      const coreY = centerY + Math.cos(timestamp / 5000) * (coreRadius * 0.5)

      context.beginPath()
      const coreGradient = context.createRadialGradient(
        coreX,
        coreY,
        coreRadius * 0.2,
        coreX,
        coreY,
        coreRadius
      )
      const hue = (timestamp / 50) % 360
      coreGradient.addColorStop(
        0,
        `hsla(${hue}, 100%, 70%, ${0.5 + bassEnergy * 0.5})`
      )
      coreGradient.addColorStop(
        0.6,
        `hsla(${(hue + 60) % 360}, 100%, 60%, ${0.3 + midEnergy * 0.4})`
      )
      coreGradient.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 50%, 0)`)
      context.fillStyle = coreGradient
      context.arc(coreX, coreY, coreRadius, 0, Math.PI * 2)
      context.fill()

      // 중앙 구체에서 파티클 생성
      if (bassEnergy > 0.6 && Math.random() < 0.5) {
        for (let i = 0; i < 3; i++) {
          createParticle(
            coreX,
            coreY,
            bassEnergy * 200,
            `hsla(${hue}, 100%, 70%, 1)`
          )
        }
      }

      // 주파수 바
      const numBars = 64 // 128에서 64로 감소
      const barStep = Math.floor(bufferLength / numBars)
      const barMaxRadius = coreRadius + 20 + 150 * (0.5 + overallEnergy * 0.5)

      for (let i = 0; i < numBars; i++) {
        const barFreqIndex = i * barStep
        if (barFreqIndex >= bufferLength) break

        const barValue = freqData[barFreqIndex] / 255
        const barHeight = barValue * barMaxRadius
        if (barHeight < 1) continue

        const angle =
          (i / numBars) * Math.PI * 2 - Math.PI / 2 + timestamp / 8000

        context.beginPath()
        context.moveTo(centerX, centerY)
        context.lineTo(
          centerX + Math.cos(angle) * barHeight,
          centerY + Math.sin(angle) * barHeight
        )
        context.lineWidth = (width / numBars) * 0.6
        context.strokeStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
          80 + barValue * 20
        }%, ${50 + barValue * 20}%, ${0.6 + barValue * 0.4})`
        context.stroke()

        context.beginPath()
        context.arc(
          centerX + Math.cos(angle) * barHeight,
          centerY + Math.sin(angle) * barHeight,
          context.lineWidth / 2 + barValue * 2,
          0,
          Math.PI * 2
        )
        context.fillStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
          90 + barValue * 20
        }%, ${60 + barValue * 20}%, ${0.2 + barValue * 0.3})`
        context.fill()

        if (barValue > 0.7 && Math.random() < 0.1) {
          createParticle(
            centerX + Math.cos(angle) * barHeight,
            centerY + Math.sin(angle) * barHeight,
            barValue * 100,
            `hsla(${hue + i * 2 + barValue * 50}, 100%, 75%, 1)`
          )
        }
      }

      // 외곽 파형
      context.lineWidth = 2
      const waveformRadius = barMaxRadius + 30 + midEnergy * 50
      context.beginPath()
      for (let i = 0; i < bufferLength * 0.5; i++) {
        const v = timeData[i] / 128.0
        const currentRadius = waveformRadius + (v - 1) * (20 + midEnergy * 30)
        const angle =
          (i / (bufferLength * 0.5)) * Math.PI * 2 -
          Math.PI / 2 -
          timestamp / 10000

        const x = coreX + Math.cos(angle) * currentRadius
        const y = coreY + Math.sin(angle) * currentRadius

        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.closePath()
      context.strokeStyle = `hsla(${(hue + 180) % 360}, 100%, 70%, ${
        0.3 + overallEnergy * 0.5
      })`
      context.shadowColor = `hsla(${(hue + 180) % 360}, 100%, 70%, 0.7)`
      context.shadowBlur = 10 + overallEnergy * 10
      context.stroke()
      context.shadowColor = "transparent"
      context.shadowBlur = 0

      // 임팩트 플래시
      if (overallEnergy > 0.7) {
        context.fillStyle = `rgba(255, 255, 255, ${overallEnergy * 0.2 - 0.1})`
        context.fillRect(-width / 2, -height / 2, width, height)
      }

      // 디지털 비 그리기
      drawDigitalRain(context, height, overallEnergy)

      // 에너지가 높을 때 디지털 비 효과 강화
      if (overallEnergy > 0.3) {
        digitalRainRef.current.forEach((rain) => {
          rain.speed *= 1.05
          rain.opacity = Math.min(1, rain.opacity * 1.1)
        })
      }

      // 저성능 모드에서는 시각 효과 간소화
      if (isLowPerformanceRef.current) {
        // 파티클 수 제한
        if (particlesRef.current.length > 50) {
          particlesRef.current = particlesRef.current.slice(-50)
        }

        // 주파수 바 수 감소
        const numBars = 64 // 128에서 64로 감소
        const barStep = Math.floor(bufferLength / numBars)
        const barMaxRadius = coreRadius + 20 + 150 * (0.5 + overallEnergy * 0.5)

        for (let i = 0; i < numBars; i++) {
          const barFreqIndex = i * barStep
          if (barFreqIndex >= bufferLength) break

          const barValue = freqData[barFreqIndex] / 255
          const barHeight = barValue * barMaxRadius
          if (barHeight < 1) continue

          const angle =
            (i / numBars) * Math.PI * 2 - Math.PI / 2 + timestamp / 8000

          context.beginPath()
          context.moveTo(centerX, centerY)
          context.lineTo(
            centerX + Math.cos(angle) * barHeight,
            centerY + Math.sin(angle) * barHeight
          )
          context.lineWidth = (width / numBars) * 0.6
          context.strokeStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
            80 + barValue * 20
          }%, ${50 + barValue * 20}%, ${0.6 + barValue * 0.4})`
          context.stroke()

          context.beginPath()
          context.arc(
            centerX + Math.cos(angle) * barHeight,
            centerY + Math.sin(angle) * barHeight,
            context.lineWidth / 2 + barValue * 2,
            0,
            Math.PI * 2
          )
          context.fillStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
            90 + barValue * 20
          }%, ${60 + barValue * 20}%, ${0.2 + barValue * 0.3})`
          context.fill()

          if (barValue > 0.7 && Math.random() < 0.1) {
            createParticle(
              centerX + Math.cos(angle) * barHeight,
              centerY + Math.sin(angle) * barHeight,
              barValue * 100,
              `hsla(${hue + i * 2 + barValue * 50}, 100%, 75%, 1)`
            )
          }
        }

        // 외곽 파형
        context.lineWidth = 2
        const waveformRadius = barMaxRadius + 30 + midEnergy * 50
        context.beginPath()
        for (let i = 0; i < bufferLength * 0.5; i++) {
          const v = timeData[i] / 128.0
          const currentRadius = waveformRadius + (v - 1) * (20 + midEnergy * 30)
          const angle =
            (i / (bufferLength * 0.5)) * Math.PI * 2 -
            Math.PI / 2 -
            timestamp / 10000

          const x = coreX + Math.cos(angle) * currentRadius
          const y = coreY + Math.sin(angle) * currentRadius

          if (i === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
        context.strokeStyle = `hsla(${(hue + 180) % 360}, 100%, 70%, ${
          0.3 + overallEnergy * 0.5
        })`
        context.shadowColor = `hsla(${(hue + 180) % 360}, 100%, 70%, 0.7)`
        context.shadowBlur = 10 + overallEnergy * 10
        context.stroke()
        context.shadowColor = "transparent"
        context.shadowBlur = 0
      }

      if (isListening) {
        animationFrameIdRef.current = requestAnimationFrame(draw)
      }
    },
    [
      isListening,
      createParticle,
      drawParticles,
      drawDigitalRain,
      analyser,
      dataArray,
      timeDomainArray,
      monitorPerformance,
    ]
  )

  useEffect(() => {
    if (isListening && analyser && dataArray && timeDomainArray) {
      animationFrameIdRef.current = requestAnimationFrame(draw)
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }

      // 캔버스 초기화
      const canvas = canvasRef.current
      if (canvas) {
        const context = canvas.getContext("2d")
        if (context) {
          const rect = canvas.getBoundingClientRect()
          context.clearRect(
            -rect.width / 2,
            -rect.height / 2,
            rect.width,
            rect.height
          )
          drawInitialCanvas(context, rect.width, rect.height)
        }
      }
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [
    isListening,
    draw,
    analyser,
    dataArray,
    timeDomainArray,
    drawInitialCanvas,
  ])

  return (
    <CanvasContainer>
      <Canvas ref={canvasRef} />
    </CanvasContainer>
  )
}

export default AudioVisualizerCanvas
