import React, { useRef, useState } from "react"
import styled, { keyframes, createGlobalStyle } from "styled-components"
import HangulAudioVisualizerCanvas from "./components/HangulAudioVisualizerCanvas"
import AudioVisualizerCanvas from "./components/AudioVisualizerCanvas"

// 전역 스타일 (폰트 등)
const GlobalStyle = createGlobalStyle`
  // 구글 폰트 import 제거
`

// 스타일 정의
const AudioVisualizerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px;
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
  color: #e0e0e0;
  overflow: hidden;
  position: relative;
`

const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 15px #00f2ff, 0 0 25px #00f2ff, 0 0 35px #4a00e0;
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 25px #00f2ff, 0 0 40px #00f2ff, 0 0 55px #4a00e0, 0 0 70px #8e2de2;
  }
`

const Button = styled.button`
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  border: none;
  color: white;
  padding: 15px 35px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 5px 20px rgba(74, 0, 224, 0.4);
  position: relative;
  z-index: 10;
  margin: 0 10px 15px 10px;

  &:hover {
    background: linear-gradient(135deg, #4a00e0 0%, #8e2de2 100%);
    box-shadow: 0 8px 30px rgba(142, 45, 226, 0.6);
    transform: translateY(-3px) scale(1.02);
  }

  &:disabled {
    background: #333;
    color: #777;
    cursor: not-allowed;
    opacity: 0.8;
    box-shadow: none;
    transform: none;
  }

  &.recording {
    animation: ${pulseAnimation} 2s infinite ease-in-out;
  }

  &.selected {
    background: linear-gradient(135deg, #00e676, #00b0ff);
    box-shadow: 0 0 15px #00e676, 0 0 25px #00b0ff;
  }
`

const EffectToggleContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  background: rgba(20, 30, 50, 0.4);
  padding: 10px;
  border-radius: 25px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
`

interface EffectToggleButtonProps {
  active: boolean
}

const EffectToggleButton = styled.button<EffectToggleButtonProps>`
  background: ${(props) =>
    props.active
      ? "linear-gradient(135deg, #00e676, #00b0ff)"
      : "rgba(30, 40, 60, 0.6)"};
  color: ${(props) => (props.active ? "#fff" : "#aaa")};
  border: none;
  padding: 10px 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  font-weight: ${(props) => (props.active ? "700" : "400")};
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 0 5px;
  border: 1px solid
    ${(props) =>
      props.active ? "rgba(0, 230, 118, 0.7)" : "rgba(255, 255, 255, 0.1)"};
  box-shadow: ${(props) =>
    props.active
      ? "0 0 15px rgba(0, 230, 118, 0.5), 0 0 30px rgba(0, 176, 255, 0.3)"
      : "none"};

  &:hover {
    background: ${(props) =>
      props.active
        ? "linear-gradient(135deg, #00e676, #00b0ff)"
        : "rgba(50, 60, 80, 0.8)"};
    transform: translateY(-2px);
  }
`

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const StatusText = styled.p`
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  color: #a0a0c0;
  margin-top: 20px;
  min-height: 24px;
  text-align: center;
  z-index: 10;
`

const Title = styled.h1`
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-weight: 900;
  font-size: 3em;
  color: #fff;
  letter-spacing: 2px;
  margin-bottom: 25px;
  text-shadow: 0 0 10px #00f2ff, 0 0 20px #00f2ff, 0 0 30px #4a00e0,
    0 0 40px #4a00e0;
  z-index: 10;

  @media (max-width: 768px) {
    font-size: 2.2em;
  }
`

// 시각화 타입 정의
type VisualizerType = "digital" | "hangul"

interface AudioError extends Error {
  name: string
}

const AudioVisualizer: React.FC = () => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const timeDomainArrayRef = useRef<Uint8Array | null>(null)

  const [isListening, setIsListening] = useState<boolean>(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] =
    useState<string>("음성 분석 시스템을 시작하세요")
  const [visualizerType, setVisualizerType] = useState<VisualizerType>("hangul")

  const stopListening = () => {
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current.mediaStream.getTracks().forEach((track) => track.stop())
      sourceRef.current = null
    }
    setIsListening(false)
    setStatusMessage("음성 분석 시스템을 시작하세요")
  }

  const startListening = async () => {
    console.log("startListening 시작")
    setPermissionError(null)
    setStatusMessage("마이크 권한 요청 중...")
    try {
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        setPermissionError(
          "보안 연결(HTTPS)이 필요합니다. 마이크 접근을 위해서는 HTTPS 환경에서 실행해야 합니다."
        )
        setStatusMessage("HTTPS 필요")
        return
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError("이 브라우저에서는 마이크 입력을 지원하지 않습니다.")
        setStatusMessage("오디오 API 미지원")
        return
      }

      console.log("마이크 접근 요청")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })
      console.log("마이크 접근 성공")
      setStatusMessage("마이크 활성화. 분석 시스템 가동 중...")

      const context = new (window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext ||
        AudioContext)()
      console.log("오디오 컨텍스트 생성 성공")
      audioContextRef.current = context

      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.85
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      analyserRef.current = analyser
      console.log("분석기 설정 완료")

      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source
      console.log("오디오 소스 연결 완료")

      const freqBufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(freqBufferLength)
      timeDomainArrayRef.current = new Uint8Array(analyser.fftSize)
      console.log("데이터 배열 초기화 완료", { freqBufferLength })

      console.log("Audio setup complete:", {
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        bufferLength: freqBufferLength,
      })

      setIsListening(true)
      console.log("isListening 상태 true로 설정 완료")
    } catch (err) {
      const error = err as AudioError
      console.error("마이크 접근 오류:", error)
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setPermissionError(
          "마이크 권한이 거부되었습니다. 브라우저 설정을 확인하세요."
        )
        setStatusMessage("마이크 권한 필요")
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        setPermissionError("사용 가능한 마이크를 찾을 수 없습니다.")
        setStatusMessage("마이크 없음")
      } else {
        setPermissionError(`마이크 오류: ${error.message}`)
        setStatusMessage("오디오 시작 오류")
      }
      setIsListening(false)
    }
  }

  const changeVisualizerType = (type: VisualizerType) => {
    console.log("시각화 타입 변경:", { type, 이전타입: visualizerType })
    setVisualizerType(type)
  }

  // 선택된 유형에 따라 해당 시각화 컴포넌트 렌더링
  const renderVisualizer = () => {
    console.log("시각화 렌더링:", {
      visualizerType,
      isListening,
      hasAnalyser: !!analyserRef.current,
      hasDataArray: !!dataArrayRef.current,
      hasTimeDomainArray: !!timeDomainArrayRef.current,
    })

    if (visualizerType === "digital") {
      return (
        <AudioVisualizerCanvas
          analyser={analyserRef.current}
          dataArray={dataArrayRef.current}
          timeDomainArray={timeDomainArrayRef.current}
          isListening={isListening}
        />
      )
    } else {
      return (
        <HangulAudioVisualizerCanvas
          analyser={analyserRef.current}
          dataArray={dataArrayRef.current}
          isListening={isListening}
        />
      )
    }
  }

  const handleToggleEffect = (type: VisualizerType) => {
    changeVisualizerType(type)
  }

  return (
    <>
      <GlobalStyle />
      <AudioVisualizerWrapper>
        <Title>인지기능 분석 시스템</Title>

        {renderVisualizer()}

        <EffectToggleContainer>
          <EffectToggleButton
            active={visualizerType === "digital"}
            onClick={() => handleToggleEffect("digital")}
          >
            디지털비효과
          </EffectToggleButton>
          <EffectToggleButton
            active={visualizerType === "hangul"}
            onClick={() => handleToggleEffect("hangul")}
          >
            네온자모효과
          </EffectToggleButton>
        </EffectToggleContainer>

        <ButtonGroup>
          {isListening ? (
            <Button
              onClick={stopListening}
              className="recording"
              disabled={!!permissionError}
            >
              분석 중지
            </Button>
          ) : (
            <Button onClick={startListening} disabled={!!permissionError}>
              분석 시작
            </Button>
          )}
        </ButtonGroup>

        <StatusText>
          {permissionError ? (
            <span style={{ color: "#ff6b6b", fontWeight: "bold" }}>
              {permissionError}
            </span>
          ) : (
            statusMessage
          )}
        </StatusText>
      </AudioVisualizerWrapper>
    </>
  )
}

export default AudioVisualizer
