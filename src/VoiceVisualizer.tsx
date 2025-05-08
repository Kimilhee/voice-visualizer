import React, { useRef, useEffect, useState, useCallback } from "react";
import styled, { keyframes, createGlobalStyle } from "styled-components";

// 전역 스타일 (폰트 등)
const GlobalStyle = createGlobalStyle`
  // 구글 폰트 import 제거
`;

// 스타일 정의
const AudioVisualizerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh; // 전체 화면을 채우도록
  margin: 0 auto;
  padding: 20px;
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
  color: #e0e0e0;
  overflow: hidden; // 파티클 등이 화면 밖으로 나갈 때 스크롤 방지
  position: relative; // 자식 요소의 absolute 포지셔닝 기준
`;

const Canvas = styled.canvas`
  width: 90vw; // 뷰포트 너비의 90%
  height: 70vh; // 뷰포트 높이의 70%
  max-width: 1200px;
  max-height: 700px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  margin-bottom: 30px;
  box-shadow: 0 0 30px rgba(74, 0, 224, 0.5), 0 0 60px rgba(0, 242, 255, 0.3);
  border: 1px solid rgba(0, 242, 255, 0.2);
  display: block; // 추가: 블록 레벨 요소로 변경
  margin-left: auto; // 추가: 좌우 자동 마진으로 중앙 정렬
  margin-right: auto; // 추가: 좌우 자동 마진으로 중앙 정렬
`;

const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 15px #00f2ff, 0 0 25px #00f2ff, 0 0 35px #4a00e0;
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 25px #00f2ff, 0 0 40px #00f2ff, 0 0 55px #4a00e0, 0 0 70px #8e2de2;
  }
`;

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
  z-index: 10; // 다른 요소 위에 있도록

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
`;

const StatusText = styled.p`
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  color: #a0a0c0;
  margin-top: 20px;
  min-height: 24px;
  text-align: center;
  z-index: 10;
`;

const Title = styled.h1`
  // h1으로 변경하여 중요도 강조
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
`;

// 파티클 인터페이스
interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  life: number; // 파티클 수명
  maxLife: number;
}

// 메트릭스 스타일의 디지털 비를 위한 인터페이스 추가
interface DigitalRain {
  x: number;
  y: number;
  baseSpeed: number;
  speedVariation: number;
  speedPattern: number;
  currentSpeed: number;
  speed: number;
  length: number;
  characters: { char: string; brightness: number }[];
  opacity: number;
}

const AudioVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null); // 주파수 데이터
  const timeDomainArrayRef = useRef<Uint8Array | null>(null); // 시간 도메인 (파형) 데이터
  const animationFrameIdRef = useRef<number | null>(null);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] =
    useState<string>("음성 분석 시스템을 시작하세요");

  const particlesRef = useRef<Particle[]>([]); // 파티클 배열
  const digitalRainRef = useRef<DigitalRain[]>([]); // 디지털 비 배열 추가

  const drawInitialCanvas = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.fillStyle = "rgba(10, 10, 20, 0.95)";
      context.fillRect(-width / 2, -height / 2, width, height);
      context.font =
        "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      context.fillStyle = "rgba(0, 200, 255, 0.6)";
      context.textAlign = "center";
      context.fillText("SYSTEM STANDBY", 0, -20);
      context.font =
        "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      context.fillStyle = "rgba(150, 150, 180, 0.5)";
      context.fillText("PRESS START TO ENGAGE AUDIO ANALYSIS", 0, 20);
    },
    []
  );

  // 디지털 비 초기화 함수 수정
  const initializeDigitalRain = useCallback((width: number, height: number) => {
    const columns = Math.floor(width / 10);
    digitalRainRef.current = Array.from({ length: columns }, (_, i) => {
      // 각 열마다 고유한 속도 특성 생성
      const baseSpeed = 0.1 + Math.random() * 0.8; // 0.1 ~ 0.9 범위로 조정
      const speedVariation = 0.1 + Math.random() * 0.3; // 속도 변화량 감소
      const speedPattern = Math.random() > 0.5 ? 1 : -1; // 속도 증가/감소 패턴

      return {
        x: i * 10 - width / 2,
        y: -height / 2,
        baseSpeed,
        speedVariation,
        speedPattern,
        currentSpeed: baseSpeed,
        speed: baseSpeed,
        length: 5 + Math.floor(Math.random() * 15),
        characters: Array.from({ length: 20 }, () => {
          const charSet = "0123456789ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
          return {
            char: charSet[Math.floor(Math.random() * charSet.length)],
            brightness: Math.random() * 0.5 + 0.5,
          };
        }),
        opacity: 0.3 + Math.random() * 0.7,
      };
    });
  }, []);

  const stopListening = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current.mediaStream
        .getTracks()
        .forEach((track) => track.stop());
      sourceRef.current = null;
    }
    particlesRef.current = []; // 파티클 초기화
    setIsListening(false);
    setStatusMessage("음성 분석 시스템을 시작하세요");

    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        context.clearRect(
          -rect.width / 2,
          -rect.height / 2,
          rect.width,
          rect.height
        );
        drawInitialCanvas(context, rect.width, rect.height);
      }
    }
  }, [drawInitialCanvas]);

  useEffect(() => {
    return () => {
      stopListening();
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current
          .close()
          .catch((e) =>
            console.error("Error closing AudioContext on unmount", e)
          );
        audioContextRef.current = null;
      }
    };
  }, [stopListening]);

  // 파티클 생성 함수
  const createParticle = useCallback(
    (x: number, y: number, energy: number, baseColor: string) => {
      const size = Math.random() * 3 + 1 + energy * 0.05;
      const speedFactor = 1 + energy * 0.02;
      const particle: Particle = {
        x,
        y,
        size,
        speedX: (Math.random() - 0.5) * (2 * speedFactor),
        speedY: (Math.random() - 0.5) * (2 * speedFactor) - energy * 0.01, // 위로 조금 더 올라가도록
        color: baseColor,
        life: 100 + Math.random() * 50 + energy, // 에너지에 따라 수명 증가
        maxLife: 100 + Math.random() * 50 + energy,
      };
      particlesRef.current.push(particle);
      if (particlesRef.current.length > 200) {
        // 파티클 최대 개수 제한
        particlesRef.current.shift();
      }
    },
    []
  );

  // 파티클 업데이트 및 그리기
  const drawParticles = useCallback(
    (context: CanvasRenderingContext2D, deltaTime: number) => {
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.speedX * (deltaTime / 16); // deltaTime 보정
        p.y += p.speedY * (deltaTime / 16);
        p.life -= 1.5 * (deltaTime / 16); // 수명 감소

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        const opacity = (p.life / p.maxLife) * 0.8; // 서서히 사라지도록
        context.beginPath();
        context.arc(
          p.x,
          p.y,
          p.size * (p.life / p.maxLife),
          0,
          Math.PI * 2,
          false
        ); // 크기도 줄어들도록
        context.fillStyle = `${p.color.slice(0, -2)}${opacity})`; // rgba(r,g,b, OPACITY)
        context.fill();
      }
    },
    []
  );

  // 디지털 비 그리기 함수 수정
  const drawDigitalRain = useCallback(
    (
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      energy: number
    ) => {
      context.font =
        "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

      digitalRainRef.current.forEach((rain) => {
        // 시간에 따른 속도 변화 (변화량 감소)
        rain.currentSpeed += rain.speedVariation * rain.speedPattern * 0.005;

        // 속도가 너무 느리거나 빠르면 방향 전환
        if (
          rain.currentSpeed < rain.baseSpeed * 0.7 ||
          rain.currentSpeed > rain.baseSpeed * 1.3
        ) {
          rain.speedPattern *= -1;
        }

        // 에너지에 따른 속도 변화를 더 부드럽게 조정
        const energyMultiplier = 1 + energy * 0.4 * (0.2 + Math.random() * 0.8);
        const speed = rain.currentSpeed * energyMultiplier;
        const baseOpacity = rain.opacity * (0.5 + energy * 0.5);

        for (let i = 0; i < rain.length; i++) {
          const y = rain.y + i * 18;
          if (y > height / 2) continue;

          // 랜덤하게 글자 변경 (3% 확률, 에너지가 높을수록 약간 더 자주 변경)
          if (Math.random() < 0.03 * (1 + energy * 0.5)) {
            const charSet = "0123456789ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
            rain.characters[i % rain.characters.length] = {
              char: charSet[Math.floor(Math.random() * charSet.length)],
              brightness: Math.random() * 0.5 + 0.5,
            };
          }

          const { char, brightness } =
            rain.characters[i % rain.characters.length];
          const fadeRatio = 1 - i / rain.length;
          const charOpacity = baseOpacity * fadeRatio * brightness;

          const hue = 120 + (i / rain.length) * 60;
          const saturation = 100 - (i / rain.length) * 30;
          const lightness = 50 + (i / rain.length) * 20;

          // 글로우 효과를 위한 그림자 설정
          context.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${
            charOpacity * 0.5
          })`;
          context.shadowBlur = 4 + brightness * 4;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;

          // 글자 그리기
          context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${charOpacity})`;
          context.fillText(char, rain.x, y);

          // 첫 번째 글자는 더 강한 글로우 효과
          if (i === 0) {
            context.shadowBlur = 8 + brightness * 8;
            context.fillStyle = `hsla(${hue}, ${saturation}%, ${
              lightness + 20
            }%, ${charOpacity})`;
            context.fillText(char, rain.x, y);
          }
        }

        // 그림자 효과 초기화
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

        rain.y += speed;
        if (rain.y > height / 2) {
          rain.y = -height / 2;
          rain.characters = Array.from({ length: 20 }, () => {
            const charSet = "0123456789ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
            return {
              char: charSet[Math.floor(Math.random() * charSet.length)],
              brightness: Math.random() * 0.5 + 0.5,
            };
          });
        }
      });
    },
    []
  );

  const draw = useCallback(
    (timestamp: number) => {
      if (
        !analyserRef.current ||
        !canvasRef.current ||
        !dataArrayRef.current ||
        !timeDomainArrayRef.current
      ) {
        if (isListening)
          animationFrameIdRef.current = requestAnimationFrame(draw);
        return;
      }

      const lastTime = animationFrameIdRef.current
        ? animationFrameIdRef.current / 1000
        : 0;
      const currentTime = timestamp / 1000;
      const deltaTime = (currentTime - lastTime) * 1000 || 16.67; // ms 단위

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const freqData = dataArrayRef.current;
      const timeData = timeDomainArrayRef.current;

      analyserRef.current.getByteFrequencyData(freqData);
      analyserRef.current.getByteTimeDomainData(timeData);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = 0; // 중앙이 원점이므로 0으로 변경
      const centerY = 0; // 중앙이 원점이므로 0으로 변경

      // 배경 그라데이션 수정
      const gradient = context.createRadialGradient(
        centerX + Math.sin(timestamp / 5000) * 50,
        centerY,
        0,
        centerX,
        centerY,
        Math.max(width, height) / 2
      );
      gradient.addColorStop(
        0,
        `rgba(20, 30, 50, ${0.5 + Math.sin(timestamp / 2000) * 0.2})`
      );
      gradient.addColorStop(1, "rgba(9, 10, 15, 0.9)");
      context.fillStyle = gradient;
      // 배경을 중앙 기준으로 그리도록 수정
      context.fillRect(-width / 2, -height / 2, width, height);

      // 파티클 그리기 (배경 위, 주 시각화 요소 아래)
      drawParticles(context, deltaTime);

      // 1. 중앙 맥동 구체 (베이스 반응)
      const bassEnergy =
        (freqData[0] + freqData[1] + freqData[2] + freqData[3] + freqData[4]) /
        5 /
        255; // 0-1
      const midEnergy =
        freqData.slice(100, 300).reduce((s, v) => s + v, 0) / (200 * 255);
      const overallEnergy =
        freqData.reduce((s, v) => s + v, 0) / (bufferLength * 255);

      const coreRadius = 30 + bassEnergy * 100 + overallEnergy * 30;
      const coreX = centerX;
      const coreY = centerY;

      context.beginPath();
      const coreGradient = context.createRadialGradient(
        coreX,
        coreY,
        coreRadius * 0.2,
        coreX,
        coreY,
        coreRadius
      );
      const hue = (timestamp / 50) % 360;
      coreGradient.addColorStop(
        0,
        `hsla(${hue}, 100%, 70%, ${0.5 + bassEnergy * 0.5})`
      );
      coreGradient.addColorStop(
        0.6,
        `hsla(${(hue + 60) % 360}, 100%, 60%, ${0.3 + midEnergy * 0.4})`
      );
      coreGradient.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 50%, 0)`);
      context.fillStyle = coreGradient;
      context.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
      context.fill();

      // 중앙 구체에서 파티클 생성 (베이스 강할 때)
      if (bassEnergy > 0.6 && Math.random() < 0.5) {
        for (let i = 0; i < 3; i++) {
          createParticle(
            coreX,
            coreY,
            bassEnergy * 200,
            `hsla(${hue}, 100%, 70%, 1)`
          );
        }
      }

      // 2. 원형 주파수 바 (중앙 구체 주변)
      const numBars = 128;
      const barStep = Math.floor(bufferLength / numBars);
      const barMaxRadius = coreRadius + 20 + 150 * (0.5 + overallEnergy * 0.5);
      const barMinRadius = 0; // 중앙에서 시작

      for (let i = 0; i < numBars; i++) {
        const barFreqIndex = i * barStep;
        if (barFreqIndex >= bufferLength) break;

        const barValue = freqData[barFreqIndex] / 255; // 0-1
        const barHeight = barValue * barMaxRadius; // 단순화된 높이 계산
        if (barHeight < 1) continue;

        const angle =
          (i / numBars) * Math.PI * 2 - Math.PI / 2 + timestamp / 8000;

        // 중앙에서 시작하여 바깥쪽으로 뻗어나가는 선
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(
          centerX + Math.cos(angle) * barHeight,
          centerY + Math.sin(angle) * barHeight
        );
        context.lineWidth = (width / numBars) * 0.6;
        context.strokeStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
          80 + barValue * 20
        }%, ${50 + barValue * 20}%, ${0.6 + barValue * 0.4})`;
        context.stroke();

        // 바 끝에 글로우 효과
        context.beginPath();
        context.arc(
          centerX + Math.cos(angle) * barHeight,
          centerY + Math.sin(angle) * barHeight,
          context.lineWidth / 2 + barValue * 2,
          0,
          Math.PI * 2
        );
        context.fillStyle = `hsla(${hue + i * 2 + barValue * 50}, ${
          90 + barValue * 20
        }%, ${60 + barValue * 20}%, ${0.2 + barValue * 0.3})`;
        context.fill();

        // 주파수 바에서 파티클 생성
        if (barValue > 0.7 && Math.random() < 0.1) {
          createParticle(
            centerX + Math.cos(angle) * barHeight,
            centerY + Math.sin(angle) * barHeight,
            barValue * 100,
            `hsla(${hue + i * 2 + barValue * 50}, 100%, 75%, 1)`
          );
        }
      }

      // 3. 외곽 파형 (시간 도메인)
      context.lineWidth = 2;
      const waveformRadius = barMaxRadius + 30 + midEnergy * 50;
      context.beginPath();
      for (let i = 0; i < bufferLength * 0.5; i++) {
        const v = timeData[i] / 128.0; // 0 to 2
        const currentRadius = waveformRadius + (v - 1) * (20 + midEnergy * 30); // 진폭에 따른 변화
        const angle =
          (i / (bufferLength * 0.5)) * Math.PI * 2 -
          Math.PI / 2 -
          timestamp / 10000;

        const x = coreX + Math.cos(angle) * currentRadius;
        const y = coreY + Math.sin(angle) * currentRadius;

        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = `hsla(${(hue + 180) % 360}, 100%, 70%, ${
        0.3 + overallEnergy * 0.5
      })`;
      context.shadowColor = `hsla(${(hue + 180) % 360}, 100%, 70%, 0.7)`;
      context.shadowBlur = 10 + overallEnergy * 10;
      context.stroke();
      context.shadowColor = "transparent"; // 그림자 초기화
      context.shadowBlur = 0;

      // 임팩트 플래시 수정
      if (overallEnergy > 0.7) {
        context.fillStyle = `rgba(255, 255, 255, ${overallEnergy * 0.2 - 0.1})`;
        context.fillRect(-width / 2, -height / 2, width, height);
      }

      // 배경 그라데이션 후, 디지털 비 그리기
      drawDigitalRain(context, width, height, overallEnergy);

      // 주파수 바 그리기 전에 디지털 비 효과 강화
      if (overallEnergy > 0.3) {
        digitalRainRef.current.forEach((rain) => {
          rain.speed *= 1.05; // 에너지가 높을 때 속도 증가
          rain.opacity = Math.min(1, rain.opacity * 1.1); // 밝기 증가
        });
      }

      if (isListening) {
        animationFrameIdRef.current = requestAnimationFrame(draw);
      }
    },
    [isListening, createParticle, drawParticles, drawDigitalRain]
  );

  const startListening = async () => {
    setPermissionError(null);
    setStatusMessage("마이크 권한 요청 중...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError(
          "이 브라우저에서는 마이크 입력을 지원하지 않습니다."
        );
        setStatusMessage("오디오 API 미지원");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setStatusMessage("마이크 활성화. 분석 시스템 가동 중...");

      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = context;

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048; // 줄이면 반응성, 늘리면 해상도 증가
      analyser.smoothingTimeConstant = 0.8; // 0 (거침) ~ 1 (부드러움)
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const freqBufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(freqBufferLength);
      // 시간 도메인 데이터 배열도 fftSize 만큼 필요
      timeDomainArrayRef.current = new Uint8Array(analyser.fftSize);

      setIsListening(true);
    } catch (err: any) {
      console.error("마이크 접근 오류:", err);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setPermissionError(
          "마이크 권한이 거부되었습니다. 브라우저 설정을 확인하세요."
        );
        setStatusMessage("마이크 권한 필요");
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setPermissionError("사용 가능한 마이크를 찾을 수 없습니다.");
        setStatusMessage("마이크 없음");
      } else {
        setPermissionError(`마이크 오류: ${err.message}`);
        setStatusMessage("오디오 시작 오류");
      }
      setIsListening(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const context = canvas.getContext("2d");
      if (context) {
        context.scale(dpr, dpr);
        context.translate(rect.width / 2, rect.height / 2);
        initializeDigitalRain(rect.width, rect.height);
        // 초기 배경을 중앙 기준으로 그리도록 수정
        context.fillStyle = "rgba(10, 10, 20, 0.95)";
        context.fillRect(
          -rect.width / 2,
          -rect.height / 2,
          rect.width,
          rect.height
        );
        drawInitialCanvas(context, rect.width, rect.height);
      }
    }
  }, [drawInitialCanvas, initializeDigitalRain]);

  useEffect(() => {
    if (
      isListening &&
      audioContextRef.current &&
      analyserRef.current &&
      dataArrayRef.current &&
      timeDomainArrayRef.current
    ) {
      animationFrameIdRef.current = requestAnimationFrame(draw);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isListening, draw]);

  const handleButtonClick = () => {
    if (isListening) {
      stopListening();
    } else {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        audioContextRef.current
          .resume()
          .then(() => {
            startListening();
          })
          .catch((e) => {
            console.error("Error resuming AudioContext", e);
            setPermissionError(
              "오디오 컨텍스트 재개 실패. 페이지를 새로고침하거나 브라우저 설정을 확인해주세요."
            );
            setStatusMessage("오디오 컨텍스트 오류");
          });
      } else {
        startListening();
      }
    }
  };

  return (
    <>
      <GlobalStyle />
      <AudioVisualizerWrapper>
        <Title>AUDIO REACT SPECTRON</Title>
        <Canvas ref={canvasRef} />
        <Button
          onClick={handleButtonClick}
          disabled={!!permissionError && !isListening}
          className={isListening ? "recording" : ""}
        >
          {isListening ? "SYSTEM DEACTIVATE" : "SYSTEM ACTIVATE"}
        </Button>
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
  );
};

export default AudioVisualizer;
