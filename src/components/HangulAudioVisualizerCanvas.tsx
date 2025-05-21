import React, { useRef, useEffect, useCallback } from "react"
import styled from "styled-components"

// 한글/숫자 집합
const HANGUL_CHARS =
  "0123456789ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ"

const CanvasContainer = styled.div`
  width: 90vw;
  max-width: 1200px;
  position: relative;
  margin-bottom: 30px;
  &::before {
    content: "";
    display: block;
    padding-top: 56.25%;
  }
`

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.95);
  border-radius: 15px;
  box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
  border: 1px solid rgba(0, 255, 0, 0.2);
`

interface Character {
  char: string
  x: number
  y: number
  size: number
  opacity: number
  life: number
  maxLife: number
  speed: number
}

// 파동 인터페이스 정의
interface WaveRipple {
  radius: number // 현재 반지름
  maxRadius: number // 최대 반지름
  alpha: number // 투명도
  lineWidth: number // 선 두께
  hue: number // 색상 (HSL)
  speed: number // 확장 속도
  startTime: number // 생성 시간 (타이머용)
}

interface HangulAudioVisualizerCanvasProps {
  analyser: AnalyserNode | null
  dataArray: Uint8Array | null
  isListening: boolean
}

const HangulAudioVisualizerCanvas: React.FC<
  HangulAudioVisualizerCanvasProps
> = ({ analyser, dataArray, isListening }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameIdRef = useRef<number | null>(null)
  const charactersRef = useRef<Character[]>([])
  const ripplesRef = useRef<WaveRipple[]>([]) // 파동 배열

  // 캔버스 초기화
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
        console.log("HangulAudioVisualizer 캔버스 초기화 완료", {
          width: rect.width,
          height: rect.height,
        })
      }
    }
  }, [])

  // 글자 생성 함수
  const createCharacter = useCallback((x: number, y: number) => {
    if (charactersRef.current.length >= 50) return
    const char: Character = {
      char: HANGUL_CHARS[Math.floor(Math.random() * HANGUL_CHARS.length)],
      x,
      y,
      size: 20 + Math.random() * 20,
      opacity: 0,
      life: 0,
      maxLife: 35 + Math.random() * 25, // 수명 감소 (45~80 → 35~60)
      speed: 0.8 + Math.random() * 0.6,
    }
    charactersRef.current.push(char)
  }, [])

  // 글자 업데이트 및 그리기
  const drawCharacters = useCallback(
    (context: CanvasRenderingContext2D, deltaTime: number) => {
      context.save()

      for (let i = charactersRef.current.length - 1; i >= 0; i--) {
        const char = charactersRef.current[i]
        char.life += char.speed * (deltaTime / 16)
        if (char.life >= char.maxLife) {
          charactersRef.current.splice(i, 1)
          continue
        }
        const lifeRatio = char.life / char.maxLife
        const size = char.size * (1 + Math.sin(lifeRatio * Math.PI) * 0.3)
        const opacity = Math.pow(Math.sin(lifeRatio * Math.PI), 1.2) // 투명도 변화를 더 부드럽게 (1.5 → 1.2)
        context.font = `bold ${size}px 'Segoe UI', 'Apple SD Gothic Neo', Arial, sans-serif`
        context.textAlign = "center"
        context.textBaseline = "middle"

        // 네온 효과 단순화
        context.shadowColor = "#00ff99"
        context.shadowBlur = 10 * (size / 40)
        context.fillStyle = `rgba(186,255,201,${opacity})`
        context.fillText(char.char, char.x, char.y)

        context.shadowBlur = 0
        context.fillStyle = `rgba(255,255,255,${opacity})`
        context.fillText(char.char, char.x, char.y)
      }

      context.restore()
    },
    []
  )

  const draw = useCallback(() => {
    if (!analyser || !canvasRef.current || !dataArray) {
      if (isListening) {
        animationFrameIdRef.current = requestAnimationFrame(draw)
      }
      return
    }

    const deltaTime = 16.67
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const width = canvas.width
    const height = canvas.height
    const dpr = window.devicePixelRatio || 1

    // 배경
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = "rgba(0, 0, 0, 0.95)"
    context.fillRect(0, 0, width, height)
    context.restore()

    try {
      analyser.getByteFrequencyData(dataArray)
      const centerX = 0
      const centerY = 0

      // 전체 에너지 계산 최적화
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const overallEnergy = sum / (dataArray.length * 255)

      const currentTime = performance.now()
      const lastRipple = ripplesRef.current[ripplesRef.current.length - 1]
      const timeSinceLastRipple = lastRipple
        ? currentTime - lastRipple.startTime
        : 1000

      // 파동 생성 간격 조정
      const minTimeBetweenRipples = 300 - overallEnergy * 200

      // 주파수 범위 계산 최적화
      const bassRange = dataArray.slice(0, Math.floor(dataArray.length * 0.2))
      const midRange = dataArray.slice(
        Math.floor(dataArray.length * 0.2),
        Math.floor(dataArray.length * 0.5)
      )

      let bassSum = 0
      let midSum = 0
      for (let i = 0; i < bassRange.length; i++) bassSum += bassRange[i]
      for (let i = 0; i < midRange.length; i++) midSum += midRange[i]

      const bassEnergy = bassSum / (bassRange.length * 255)
      const midEnergy = midSum / (midRange.length * 255)

      // 파동 생성 임계값 낮춤
      let shouldCreateParticles = false
      if (
        (bassEnergy > 0.05 || midEnergy > 0.07) &&
        timeSinceLastRipple > minTimeBetweenRipples
      ) {
        shouldCreateParticles = true
        const energyFactor = overallEnergy * 0.7 + bassEnergy * 0.3
        let baseRadiusRatio
        let speedFactor

        if (energyFactor < 0.25) {
          baseRadiusRatio = 0.1 + (energyFactor / 0.25) * 0.1
          speedFactor = 0.6 + (energyFactor / 0.25) * 0.4
        } else if (energyFactor < 0.6) {
          baseRadiusRatio = 0.2 + ((energyFactor - 0.25) / 0.35) * 0.15
          speedFactor = 1.0 + ((energyFactor - 0.25) / 0.35) * 0.5
        } else {
          baseRadiusRatio = 0.35 + ((energyFactor - 0.6) / 0.4) * 0.15
          speedFactor = 1.5 + ((energyFactor - 0.6) / 0.4) * 0.8
        }

        const maxRadius = Math.min(width, height) * baseRadiusRatio
        const hue =
          bassEnergy > 0.4
            ? 240 + Math.random() * 40
            : midEnergy > 0.3
            ? 120 + Math.random() * 60
            : bassEnergy > midEnergy
            ? 180 + Math.random() * 60
            : 20 + Math.random() * 40

        const lineWidth = 2 + bassEnergy * 3 + midEnergy * 1.5
        const speed = (1.0 + energyFactor * 2) * speedFactor

        ripplesRef.current.push({
          radius: 5,
          maxRadius: maxRadius,
          alpha: 0.7 + energyFactor * 0.3,
          lineWidth: lineWidth,
          hue: hue,
          speed: speed,
          startTime: currentTime,
        })

        // 파동 수 제한
        if (ripplesRef.current.length > 6) {
          ripplesRef.current.shift()
        }
      }

      // 파동 그리기 최적화
      context.save()
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const ripple = ripplesRef.current[i]
        ripple.radius += ripple.speed
        const lifeRatio = ripple.radius / ripple.maxRadius
        ripple.alpha = Math.max(0, 1 - lifeRatio)

        if (ripple.radius >= ripple.maxRadius) {
          ripplesRef.current.splice(i, 1)
          continue
        }

        context.beginPath()
        context.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2)
        context.lineWidth = ripple.lineWidth * (1 - lifeRatio * 0.7)
        context.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})`
        context.shadowBlur = 25 * ripple.alpha
        context.shadowColor = `hsla(${ripple.hue}, 100%, 70%, ${ripple.alpha})`
        context.stroke()
      }
      context.restore()

      // 한글 파티클 생성 - 파동 생성과 연동
      if (shouldCreateParticles || overallEnergy > 0.008) {
        // 임계값 더 낮춤
        const numNewChars = Math.floor(
          overallEnergy * 25 + (shouldCreateParticles ? 5 : 0)
        )
        const displayWidth = width / dpr / 2
        const displayHeight = height / dpr / 2

        for (let i = 0; i < numNewChars; i++) {
          const x = (Math.random() * 2 - 1) * displayWidth
          const y = (Math.random() * 2 - 1) * displayHeight
          createCharacter(x, y)
        }
      }
      drawCharacters(context, deltaTime)
    } catch (error) {
      console.error("오디오 데이터 처리 중 오류:", error)
    }

    if (isListening) {
      animationFrameIdRef.current = requestAnimationFrame(draw)
    }
  }, [isListening, analyser, dataArray, createCharacter, drawCharacters])

  useEffect(() => {
    console.log("HangulAudioVisualizer useEffect 실행", {
      isListening,
      hasAnalyser: !!analyser,
      hasDataArray: !!dataArray,
    })

    if (isListening && analyser && dataArray) {
      console.log("애니메이션 프레임 요청됨")
      animationFrameIdRef.current = requestAnimationFrame(draw)
    } else {
      if (animationFrameIdRef.current) {
        console.log("애니메이션 프레임 취소됨")
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }
      // 캔버스 초기화
      const canvas = canvasRef.current
      if (canvas) {
        const context = canvas.getContext("2d")
        if (context) {
          context.save()
          context.setTransform(1, 0, 0, 1, 0, 0) // 변환 초기화
          context.fillStyle = "rgba(0, 0, 0, 0.95)"
          context.fillRect(0, 0, canvas.width, canvas.height)
          context.restore()
        }
      }
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [isListening, draw, analyser, dataArray])

  return (
    <CanvasContainer>
      <Canvas ref={canvasRef} />
    </CanvasContainer>
  )
}

export default HangulAudioVisualizerCanvas
