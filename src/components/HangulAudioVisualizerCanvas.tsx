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
    if (charactersRef.current.length >= 100) return
    const char: Character = {
      char: HANGUL_CHARS[Math.floor(Math.random() * HANGUL_CHARS.length)],
      x,
      y,
      size: 20 + Math.random() * 30,
      opacity: 0,
      life: 0,
      maxLife: 40 + Math.random() * 40,
      speed: 1.5 + Math.random() * 1.0,
    }
    charactersRef.current.push(char)
  }, [])

  // 글자 업데이트 및 그리기
  const drawCharacters = useCallback(
    (context: CanvasRenderingContext2D, deltaTime: number) => {
      context.save() // 상태 저장 (그림자 효과를 위해)

      for (let i = charactersRef.current.length - 1; i >= 0; i--) {
        const char = charactersRef.current[i]
        char.life += char.speed * (deltaTime / 16)
        if (char.life >= char.maxLife) {
          charactersRef.current.splice(i, 1)
          continue
        }
        const lifeRatio = char.life / char.maxLife
        const size = char.size * (1 + Math.sin(lifeRatio * Math.PI) * 0.5)
        const opacity = Math.pow(Math.sin(lifeRatio * Math.PI), 1.8)
        context.font = `bold ${size}px 'Segoe UI', 'Apple SD Gothic Neo', Arial, sans-serif`
        context.textAlign = "center"
        context.textBaseline = "middle"
        // 네온 효과
        const shadowLayers = [
          { color: "#00ff99", blur: 10 },
          { color: "#00e676", blur: 25 },
        ]
        for (const layer of shadowLayers) {
          context.shadowColor = layer.color
          context.shadowBlur = layer.blur * (size / 40)
          context.fillStyle = `rgba(186,255,201,${opacity})`
          context.fillText(char.char, char.x, char.y)
        }
        context.shadowBlur = 0
        context.fillStyle = `rgba(255,255,255,${opacity})`
        context.fillText(char.char, char.x, char.y)
      }

      context.restore() // 상태 복원
    },
    []
  )

  const draw = useCallback(() => {
    console.log("HangulAudioVisualizer draw 호출됨", {
      isListening,
      analyser,
      dataArray,
    })

    if (!analyser || !canvasRef.current || !dataArray) {
      console.log("조건 미충족:", {
        hasAnalyser: !!analyser,
        hasCanvas: !!canvasRef.current,
        hasDataArray: !!dataArray,
      })
      if (isListening) {
        animationFrameIdRef.current = requestAnimationFrame(draw)
      }
      return
    }

    const deltaTime = 16.67 // 약 60fps 가정 (나중에 실제 시간 차이 계산으로 개선 가능)

    // 필요한 변수들 한 번에 정의
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) {
      console.error("캔버스 컨텍스트를 가져올 수 없음")
      return
    }

    const width = canvas.width
    const height = canvas.height
    const dpr = window.devicePixelRatio || 1

    // 배경
    context.save() // 현재 상태 저장
    context.setTransform(1, 0, 0, 1, 0, 0) // 변환 초기화
    context.fillStyle = "rgba(0, 0, 0, 0.95)"
    context.fillRect(0, 0, width, height)
    context.restore() // 이전 상태 복원 (translate 등 유지)

    try {
      // 오디오 데이터 가져오기
      analyser.getByteFrequencyData(dataArray)

      // 이제 중앙이 (0,0)인 좌표계로 그리기
      const centerX = 0
      const centerY = 0

      // 전체 에너지 계산
      const overallEnergy =
        dataArray.reduce((sum, value) => sum + value, 0) /
        (dataArray.length * 255)

      // 현재 시간 (파동 생성 타이밍 제어용)
      const currentTime = performance.now()
      const lastRipple = ripplesRef.current[ripplesRef.current.length - 1]
      const timeSinceLastRipple = lastRipple
        ? currentTime - lastRipple.startTime
        : 1000

      // 에너지 수준에 따라 파동 생성 간격 조정 (에너지가 높을수록 더 자주 생성)
      const minTimeBetweenRipples = 200 - overallEnergy * 150 // 50~200ms 범위 (소리가 클수록 더 자주 생성)

      // 베이스 주파수 에너지 계산
      const bassRange = dataArray.slice(0, Math.floor(dataArray.length * 0.2))
      const bassEnergy =
        bassRange.reduce((sum, value) => sum + value, 0) /
        (bassRange.length * 255)
      const midRange = dataArray.slice(
        Math.floor(dataArray.length * 0.2),
        Math.floor(dataArray.length * 0.5)
      )
      const midEnergy =
        midRange.reduce((sum, value) => sum + value, 0) /
        (midRange.length * 255)

      // 소리가 있고, 일정 시간이 지났으면 새 파동 생성
      if (
        (bassEnergy > 0.08 || midEnergy > 0.1) &&
        timeSinceLastRipple > minTimeBetweenRipples
      ) {
        // 파동 크기와 속도를 에너지와 주파수 특성에 따라 다양하게 설정
        const energyFactor = overallEnergy * 0.7 + bassEnergy * 0.3 // 전체 에너지와 베이스 에너지 조합

        // 소리 크기에 따라 최대 반지름을 더 극적으로 변화
        // 작은 소리 (에너지가 낮음): 화면의 10~20% 정도 크기
        // 중간 소리 (에너지가 중간): 화면의 20~35% 정도 크기
        // 큰 소리 (에너지가 높음): 화면의 35~50% 정도 크기
        let baseRadiusRatio
        let speedFactor // 속도 계수 추가

        if (energyFactor < 0.25) {
          // 작은 소리
          baseRadiusRatio = 0.1 + (energyFactor / 0.25) * 0.1 // 10~20%
          speedFactor = 0.6 + (energyFactor / 0.25) * 0.4 // 속도 계수 0.6~1.0
        } else if (energyFactor < 0.6) {
          // 중간 소리
          baseRadiusRatio = 0.2 + ((energyFactor - 0.25) / 0.35) * 0.15 // 20~35%
          speedFactor = 1.0 + ((energyFactor - 0.25) / 0.35) * 0.5 // 속도 계수 1.0~1.5
        } else {
          // 큰 소리
          baseRadiusRatio = 0.35 + ((energyFactor - 0.6) / 0.4) * 0.15 // 35~50%
          speedFactor = 1.5 + ((energyFactor - 0.6) / 0.4) * 0.8 // 속도 계수 1.5~2.3
        }

        // 기본 비율에 약간의 랜덤 요소 추가 (더 자연스러운 느낌)
        const randomVariation = Math.random() * 0.05 - 0.025 // ±2.5% 변동
        const maxRadius =
          Math.min(width, height) * (baseRadiusRatio + randomVariation)

        // 베이스와 중간음역에 따라 다른 색상 사용 (네온 효과용)
        let hue
        // 더 넓은 색상 범위와 다양한 색상 사용
        if (bassEnergy > 0.4) {
          // 강한 베이스: 보라~파랑 계열 (240~280)
          hue = 240 + Math.random() * 40
        } else if (midEnergy > 0.3) {
          // 강한 중음역: 초록~시안 계열 (120~180)
          hue = 120 + Math.random() * 60
        } else if (bassEnergy > midEnergy) {
          // 베이스가 우세: 파랑~시안 계열 (180~240)
          hue = 180 + Math.random() * 60
        } else {
          // 기본: 노랑~주황 계열 (20~60)
          hue = 20 + Math.random() * 40
        }

        // 파동 두께와 속도도 주파수 특성에 맞게 조정
        const lineWidth = 2.5 + bassEnergy * 4 + midEnergy * 2

        // 소리 크기에 맞게 속도 조정
        const speed = (1.0 + energyFactor * 2.5) * speedFactor

        // 새 파동 생성
        ripplesRef.current.push({
          radius: 5,
          maxRadius: maxRadius,
          alpha: 0.7 + energyFactor * 0.3, // 에너지가 강할수록 더 선명하게
          lineWidth: lineWidth,
          hue: hue,
          speed: speed,
          startTime: currentTime,
        })

        // 파동이 너무 많아지지 않도록 제한
        if (ripplesRef.current.length > 10) {
          ripplesRef.current.shift() // 가장 오래된 파동 제거
        }
      }

      // 처음 로드 시 파동이 없으면 기본 파동 하나 생성
      if (ripplesRef.current.length === 0) {
        const maxRadius = Math.min(width, height) * 0.3

        ripplesRef.current.push({
          radius: 10,
          maxRadius: maxRadius,
          alpha: 0.7,
          lineWidth: 3,
          hue: 200,
          speed: 2,
          startTime: currentTime,
        })
      }

      // 모든 파동 업데이트 및 그리기
      context.save()

      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const ripple = ripplesRef.current[i]

        // 파동 확장
        ripple.radius += ripple.speed

        // 투명도 감소 (바깥으로 퍼질수록 사라짐)
        const lifeRatio = ripple.radius / ripple.maxRadius
        ripple.alpha = Math.max(0, 1 - lifeRatio)

        // 파동이 최대 크기에 도달하면 제거
        if (ripple.radius >= ripple.maxRadius) {
          ripplesRef.current.splice(i, 1)
          continue
        }

        // 파동 그리기
        context.beginPath()
        context.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2)

        // 선 두께도 수명에 따라 변화 (바깥으로 갈수록 얇아짐)
        context.lineWidth = ripple.lineWidth * (1 - lifeRatio * 0.7)

        // 더 명확한 네온 효과 적용
        // 동심원은 항상 흰색으로, 네온 효과만 색상 차이
        const glowIntensity = 1.2 + ripple.alpha * 0.4 // 글로우 효과 더 강화
        context.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})` // 흰색 동심원

        // 메인 네온 효과 (매우 강한 외부 글로우)
        context.shadowBlur = 35 * ripple.alpha * glowIntensity // 블러 효과 대폭 증가
        context.shadowColor = `hsla(${ripple.hue}, 100%, 70%, ${
          ripple.alpha * 1.2
        })` // 더 밝고 선명한 색상
        context.lineWidth = context.lineWidth * 1.2 // 선 두께 증가

        // 외부 글로우 효과
        context.stroke()

        // 중간 레이어 글로우 효과 (더 집중된 네온 효과)
        context.save()
        context.beginPath()
        context.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2)
        context.lineWidth = context.lineWidth * 0.7
        context.shadowBlur = 20 * ripple.alpha * glowIntensity
        context.shadowColor = `hsla(${ripple.hue}, 100%, 75%, ${
          ripple.alpha * 1.3
        })`
        context.strokeStyle = `hsla(${ripple.hue}, 30%, 90%, ${
          ripple.alpha * 0.9
        })` // 약간의 색조가 있는 흰색
        context.stroke()
        context.restore()

        // 내부 글로우 효과 (가장 선명한 네온 라인)
        if (ripple.alpha > 0.3) {
          // 더 오래 보이도록 임계값 낮춤
          context.save()
          context.beginPath()
          context.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2)
          context.lineWidth = context.lineWidth * 0.4
          context.shadowBlur = 15
          // 내부 그림자는 가장 밝고 선명하게
          context.shadowColor = `hsla(${ripple.hue}, 100%, 80%, ${
            ripple.alpha * 1.4
          })`
          // 약간의 색조를 추가한 선
          context.strokeStyle = `hsla(${ripple.hue}, 50%, 95%, ${
            ripple.alpha * 1.1
          })`
          context.stroke()
          context.restore()
        }

        // 추가 글로우 포인트 (네온 효과를 더 강조하는 작은 점)
        if (ripple.alpha > 0.5) {
          const pointSize = ripple.lineWidth * 0.8
          const pointCount = 12

          context.save()
          context.fillStyle = `hsla(${ripple.hue}, 100%, 85%, ${
            ripple.alpha * 1.3
          })`
          context.shadowBlur = 10
          context.shadowColor = `hsla(${ripple.hue}, 100%, 80%, ${ripple.alpha})`

          for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * Math.PI * 2
            const pointX = centerX + Math.cos(angle) * ripple.radius
            const pointY = centerY + Math.sin(angle) * ripple.radius

            context.beginPath()
            context.arc(pointX, pointY, pointSize, 0, Math.PI * 2)
            context.fill()
          }
          context.restore()
        }
      }

      context.restore()
    } catch (error) {
      console.error("오디오 데이터 처리 중 오류:", error)
    }

    // 오디오 데이터 분석 (네온 한글용)
    if (analyser && dataArray) {
      try {
        analyser.getByteFrequencyData(dataArray)
        const overallEnergyForText =
          dataArray.reduce((sum, value) => sum + value, 0) /
          (dataArray.length * 255)

        // 에너지에 따라 새로운 글자 생성
        if (overallEnergyForText > 0.01) {
          const numNewChars = Math.floor(overallEnergyForText * 35)
          // width와 height 값을 화면 좌표로 변환 (중앙이 0,0이므로)
          const displayWidth = width / dpr / 2
          const displayHeight = height / dpr / 2

          for (let i = 0; i < numNewChars; i++) {
            const x = (Math.random() * 2 - 1) * displayWidth
            const y = (Math.random() * 2 - 1) * displayHeight
            createCharacter(x, y)
          }
        }
        // 글자 그리기
        drawCharacters(context, deltaTime)
      } catch (error) {
        console.error("한글 시각화 처리 중 오류:", error)
      }
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
