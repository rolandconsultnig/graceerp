import { useEffect, useRef, useState, useCallback } from 'react';
import { memberPortalAPI } from '../services/api';
import { canUseLiveMedia } from '../utils/portalChat';
import { Button } from './UI';

const DEFAULT_RING_MS = { outgoing: 55000, incoming: 75000 };

/**
 * Voice/video calls over WebRTC; signaling relayed on the portal chat WebSocket.
 * WS URL uses ws:// or wss:// to match the page protocol. Media APIs require HTTPS except on localhost.
 */
export default function PortalWebRtcDock({ subscribeSignals, sendSignal, wsConnected, selfRole }) {
  const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }]);
  const [ringMs, setRingMs] = useState(DEFAULT_RING_MS);
  const [mediaOk, setMediaOk] = useState(true);
  const [callState, setCallState] = useState('idle');
  const [incomingMedia, setIncomingMedia] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceQueueRef = useRef([]);
  /** Buffered SDP offer if it arrives before callee finishes accepting */
  const bufferedOfferRef = useRef(null);

  const phaseRef = useRef('idle');
  const activeMediaRef = useRef(null);

  useEffect(() => {
    phaseRef.current = callState;
  }, [callState]);
  useEffect(() => {
    activeMediaRef.current = activeMedia;
  }, [activeMedia]);

  const ringMsRef = useRef(ringMs);
  useEffect(() => {
    ringMsRef.current = ringMs;
  }, [ringMs]);

  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);

  const outgoingRingTimerRef = useRef(null);
  const incomingRingTimerRef = useRef(null);
  const hangupRef = useRef(() => {});
  const declineIncomingRef = useRef(() => {});

  useEffect(() => {
    memberPortalAPI
      .webrtcConfig()
      .then((r) => {
        const d = r.data?.data;
        const list = d?.iceServers;
        if (Array.isArray(list) && list.length) setIceServers(list);
        const out = d?.callTimeouts?.outgoingMs;
        const inn = d?.callTimeouts?.incomingMs;
        if (Number.isFinite(out) && Number.isFinite(inn)) {
          setRingMs({ outgoing: out, incoming: inn });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMediaOk(typeof window !== 'undefined' && canUseLiveMedia());
  }, []);

  const stopLocal = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  const teardownPeer = useCallback(() => {
    iceQueueRef.current = [];
    bufferedOfferRef.current = null;
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    stopLocal();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, [stopLocal]);

  const flushIceQueue = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const q = iceQueueRef.current.splice(0);
    for (const c of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const attachRemoteStream = useCallback((stream, media) => {
    const v = remoteVideoRef.current;
    const a = remoteAudioRef.current;
    if (!stream) return;
    const isVideo = media === 'video';
    if (isVideo && v) {
      v.srcObject = stream;
      v.muted = false;
      if (a) a.srcObject = null;
    } else if (a) {
      a.srcObject = stream;
      a.muted = false;
      if (v) v.srcObject = null;
    }
  }, []);

  const clearOutgoingRingTimer = useCallback(() => {
    if (outgoingRingTimerRef.current) {
      clearTimeout(outgoingRingTimerRef.current);
      outgoingRingTimerRef.current = null;
    }
  }, []);

  const clearIncomingRingTimer = useCallback(() => {
    if (incomingRingTimerRef.current) {
      clearTimeout(incomingRingTimerRef.current);
      incomingRingTimerRef.current = null;
    }
  }, []);

  const clearAllRingTimers = useCallback(() => {
    clearOutgoingRingTimer();
    clearIncomingRingTimer();
  }, [clearOutgoingRingTimer, clearIncomingRingTimer]);

  const hangup = useCallback(() => {
    clearAllRingTimers();
    sendSignal({ signal: 'hangup', payload: { fromRole: selfRole } });
    teardownPeer();
    setCallState('idle');
    phaseRef.current = 'idle';
    setIncomingMedia(null);
    setActiveMedia(null);
    activeMediaRef.current = null;
  }, [clearAllRingTimers, sendSignal, selfRole, teardownPeer]);

  const setupPeerCommon = useCallback(
    (pc, mediaForAttach) => {
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal({
            signal: 'ice',
            payload: { candidate: ev.candidate.toJSON(), fromRole: selfRole },
          });
        }
      };
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (stream) attachRemoteStream(stream, mediaForAttach);
      };
      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(pc.connectionState)) {
          teardownPeer();
          setCallState('idle');
          phaseRef.current = 'idle';
          setIncomingMedia(null);
          setActiveMedia(null);
          activeMediaRef.current = null;
        }
      };
    },
    [attachRemoteStream, sendSignal, selfRole, teardownPeer]
  );

  const ensureLocalStream = async (media) => {
    const constraints =
      media === 'video'
        ? { audio: true, video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } } }
        : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current && media === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
    }
    return stream;
  };

  const beginCallerNegotiation = useCallback(
    async (media) => {
      try {
        clearOutgoingRingTimer();
        const stream = await ensureLocalStream(media);
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;
        setupPeerCommon(pc, media);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
          signal: 'offer',
          payload: { type: offer.type, sdp: offer.sdp, fromRole: selfRole },
        });
        setCallState('active');
        phaseRef.current = 'active';
      } catch {
        hangup();
      }
    },
    [clearOutgoingRingTimer, hangup, iceServers, sendSignal, selfRole, setupPeerCommon]
  );

  const startOutbound = async (media) => {
    if (!mediaOk || phaseRef.current !== 'idle') return;
    clearAllRingTimers();
    setActiveMedia(media);
    activeMediaRef.current = media;
    setCallState('outgoing');
    phaseRef.current = 'outgoing';
    sendSignal({ signal: 'call-request', payload: { media, fromRole: selfRole } });
    outgoingRingTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'outgoing') return;
      hangupRef.current?.();
    }, ringMsRef.current.outgoing);
  };

  const declineIncoming = useCallback(() => {
    clearIncomingRingTimer();
    sendSignal({ signal: 'call-decline', payload: { fromRole: selfRole } });
    setCallState('idle');
    phaseRef.current = 'idle';
    setIncomingMedia(null);
    bufferedOfferRef.current = null;
  }, [clearIncomingRingTimer, sendSignal, selfRole]);

  const acceptIncoming = async () => {
    clearIncomingRingTimer();
    const media = incomingMedia || 'audio';
    sendSignal({ signal: 'call-accept', payload: { fromRole: selfRole } });
    setIncomingMedia(null);
    setActiveMedia(media);
    activeMediaRef.current = media;
    setCallState('active');
    phaseRef.current = 'active';

    try {
      const stream = await ensureLocalStream(media);
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      setupPeerCommon(pc, media);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offerInit = bufferedOfferRef.current;
      bufferedOfferRef.current = null;
      if (offerInit?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(offerInit));
        await flushIceQueue();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({
          signal: 'answer',
          payload: { type: answer.type, sdp: answer.sdp, fromRole: selfRole },
        });
      }
    } catch {
      hangup();
    }
  };

  useEffect(() => {
    const onSignal = async (msg) => {
      if (msg.type !== 'portal-signal') return;
      const { signal, payload } = msg;

      if (signal === 'hangup') {
        clearAllRingTimers();
        teardownPeer();
        setCallState('idle');
        phaseRef.current = 'idle';
        setIncomingMedia(null);
        setActiveMedia(null);
        activeMediaRef.current = null;
        return;
      }

      if (signal === 'call-decline') {
        if (phaseRef.current === 'outgoing') {
          clearOutgoingRingTimer();
          teardownPeer();
          setCallState('idle');
          phaseRef.current = 'idle';
          setActiveMedia(null);
          activeMediaRef.current = null;
        }
        return;
      }

      if (signal === 'call-request') {
        const media = payload?.media === 'video' ? 'video' : 'audio';
        if (phaseRef.current === 'idle') {
          clearIncomingRingTimer();
          setIncomingMedia(media);
          setCallState('ringing');
          phaseRef.current = 'ringing';
          incomingRingTimerRef.current = setTimeout(() => {
            if (phaseRef.current !== 'ringing') return;
            declineIncomingRef.current?.();
          }, ringMsRef.current.incoming);
        }
        return;
      }

      if (signal === 'call-accept') {
        if (phaseRef.current === 'outgoing' && activeMediaRef.current) {
          await beginCallerNegotiation(activeMediaRef.current);
        }
        return;
      }

      if (signal === 'offer') {
        const desc = payload?.sdp ? { type: payload.type, sdp: payload.sdp } : null;
        if (!desc) return;
        const pc = pcRef.current;
        if (!pc) {
          bufferedOfferRef.current = desc;
          return;
        }
        if (pc.remoteDescription) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(desc));
          await flushIceQueue();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({
            signal: 'answer',
            payload: { type: answer.type, sdp: answer.sdp, fromRole: selfRole },
          });
        } catch {
          /* ignore */
        }
        return;
      }

      if (signal === 'answer') {
        const pc = pcRef.current;
        const desc = payload?.sdp ? { type: payload.type, sdp: payload.sdp } : null;
        if (!pc || !desc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(desc));
          await flushIceQueue();
        } catch {
          /* ignore */
        }
        return;
      }

      if (signal === 'ice' && payload?.candidate) {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          iceQueueRef.current.push(payload.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          iceQueueRef.current.push(payload.candidate);
        }
      }
    };

    return subscribeSignals(onSignal);
  }, [
    subscribeSignals,
    clearAllRingTimers,
    clearOutgoingRingTimer,
    teardownPeer,
    flushIceQueue,
    sendSignal,
    selfRole,
    beginCallerNegotiation,
    setupPeerCommon,
  ]);

  useEffect(() => {
    hangupRef.current = hangup;
  }, [hangup]);

  useEffect(() => {
    declineIncomingRef.current = declineIncoming;
  }, [declineIncoming]);

  useEffect(
    () => () => {
      clearAllRingTimers();
      teardownPeer();
    },
    [clearAllRingTimers, teardownPeer]
  );

  const videoMode = activeMedia === 'video' || incomingMedia === 'video';

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
            wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {wsConnected ? 'Live chat connected' : 'Connecting…'}
        </span>
        {!mediaOk && (
          <span className="text-[11px] text-amber-800 max-sm:w-full">
            Voice/video needs HTTPS (secure site). HTTP on localhost is allowed.
          </span>
        )}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!mediaOk || callState !== 'idle'}
            onClick={() => startOutbound('audio')}
          >
            Voice call
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!mediaOk || callState !== 'idle'}
            onClick={() => startOutbound('video')}
          >
            Video call
          </Button>
          {callState !== 'idle' && (
            <Button type="button" variant="danger" size="sm" onClick={hangup}>
              End call
            </Button>
          )}
        </div>
      </div>

      {(callState === 'active' || callState === 'outgoing') && videoMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3 min-h-0">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-[min(42vh,280px)]">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 text-[10px] text-white/80 bg-black/40 px-1 rounded">You</span>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-[min(42vh,280px)]">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 text-[10px] text-white/80 bg-black/40 px-1 rounded">Guest</span>
          </div>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {callState === 'ringing' && incomingMedia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <p className="text-sm font-medium text-gray-800">
              Incoming {incomingMedia === 'video' ? 'video' : 'voice'} call…
            </p>
            <p className="text-xs text-gray-500">
              Untouched calls auto-decline after ~{Math.ceil(ringMs.incoming / 1000)}s.
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <Button type="button" variant="outline" onClick={declineIncoming}>
                Decline
              </Button>
              <Button type="button" onClick={() => acceptIncoming()}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      {callState === 'outgoing' && (
        <div className="px-3 pb-2 text-xs text-gray-600">
          Waiting for the other party (times out in ~{Math.ceil(ringMs.outgoing / 1000)}s)…
        </div>
      )}
    </div>
  );
}
