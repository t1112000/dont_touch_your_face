// Khai báo thư viện
import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { initNotifications, notify } from "@mycv/f8-notification";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import { Howl } from "howler";
import soundURL from "./assets/botayra.mp3";

const sound = new Howl({
  src: [soundURL],
});

const NOT_TOUCH_LABEL = "not touch";
const TOUCHED_LABEL = "touched";
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const mobilenetModule = useRef();
  const canPlaySound = useRef(true);
  const [loading, setLoading] = useState(0);
  const [isCamera, setIsCamera] = useState(false);
  const [step, setStep] = useState(false);
  const [step1, setStep1] = useState(false);
  const [step2, setStep2] = useState(false);
  const [step3, setStep3] = useState(false);
  const [touched, setTouched] = useState(false);

  const init = async () => {
    console.log("init...");
    await setupCamera();

    console.log("set up camera success");

    classifier.current = knnClassifier.create();
    mobilenetModule.current = await mobilenet.load();

    setStep(true);
    setIsCamera(true);

    initNotifications({ cooldown: 3000 });
  };

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          (stream) => {
            video.current.srcObject = stream;
            video.current.addEventListener("loadeddata", resolve);
          },
          (error) => reject(error)
        );
      } else {
        reject();
      }
    });
  };

  const train = async (label) => {
    console.log(`[${label}] Trainning`);
    for (let i = 0; i < TRAINING_TIMES; i++) {
      setLoading(parseInt(((i + 1) / TRAINING_TIMES) * 100));

      await trainning(label);
    }
  };

  /**
   * Bước 1: Train cho máy khuôn mặt không chạm tay
   * Bước 2: Train cho máy khuôn mặt có chạm tay
   * Bước 3: Lấy hình ảnh hiện tại, phân tích và so sánh với Data đã học trước đó
   * ==> Nếu mà maching với data khuôn mặt chạm tay ==> Cảnh báo
   * @param {*} label
   * @returns
   */

  // Hàm để Trainning Bot
  const trainning = (label) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenetModule.current.infer(video.current, true);
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    });
  };

  const run = async () => {
    // Khai báo biến embedding để nhận giá trị frame từ luồng video trực tiếp vào Database của thư viện mobilenet.
    const embedding = mobilenetModule.current.infer(video.current, true);

    // Nhận giá trị từ mobilenet và thư viện classifier KNN để bắt đầu phân tích.
    const result = await classifier.current.predictClass(embedding);

    // Nếu nhãn của giá trị đầu vào là TOUCHED_LABEL và Gía trị CONFIDENCE của giá trị lớn hơn giá trị  CONFIDENCES đã khai báo
    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      if (canPlaySound.current === true) {
        canPlaySound.current = false;
        sound.play();
      }
      setTouched(true);
      notify("Bỏ tay ra!", { body: "Bạn vừa chạm tay vào mặt" });
    } else {
      setTouched(false);
    }

    await sleep(200);

    run();
  };

  const sleep = (ms = 0) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  useEffect(() => {
    init();

    sound.on("end", () => {
      canPlaySound.current = true;
    });

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = (e) => {
    window.location.reload(e.taget);
  };

  return (
    <div className={`main ${touched ? "touched" : ""}`}>
      {video.current && <video ref={video} className="video" src="" autoPlay />}
      {!isCamera && (
        <label className="label">
          Vui lòng xác nhận camera hoặc đợi load camera !!!
        </label>
      )}
      {loading !== 100 && loading !== 0 && (
        <label className="label">
          Không chạm tay lên mặt cho tới khi hoàn thành. Máy đang học...
          {loading}%
        </label>
      )}
      {step && (
        <>
          <label className="label">
            Bước 1: Quay video không chạm tay lên mặt!
          </label>
          <button
            className="btn"
            onClick={() => {
              train(NOT_TOUCH_LABEL);
              setStep(false);
              setStep1(true);
            }}
          >
            Bắt đầu
          </button>
        </>
      )}
      {step1 && loading === 100 && (
        <>
          <label className="label">Bước 2: Quay video đưa tay lên mặt</label>
          <button
            className="btn"
            onClick={() => {
              train(TOUCHED_LABEL);
              setLoading(0);
              setStep1(false);
              setStep2(true);
            }}
          >
            Tiếp tục
          </button>
        </>
      )}
      {step2 && loading === 100 && (
        <>
          <label className="label">AI đã sẵn sàng, hãy bấm Khởi động!</label>
          <button
            className="btn"
            onClick={() => {
              run();
              setStep2(false);
              setStep3(true);
            }}
          >
            Khởi động!
          </button>
        </>
      )}
      {step3 && (
        <>
          <label className="label">AI đang theo dõi cái tay của bạn...</label>
          <button className="btn" type="reset" onClick={handleReset}>
            Reset
          </button>
        </>
      )}
    </div>
  );
}

export default App;
