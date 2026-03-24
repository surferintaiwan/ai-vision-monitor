import firestore from '@react-native-firebase/firestore';

const sessionsCollection = () => firestore().collection('sessions');

export async function createSession(cameraDeviceId: string): Promise<string> {
  const ref = await sessionsCollection().add({
    cameraDeviceId,
    viewerDeviceId: null,
    offer: null,
    answer: null,
    status: 'waiting',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function setOffer(sessionId: string, sdp: string): Promise<void> {
  await sessionsCollection().doc(sessionId).update({ offer: sdp });
}

export async function setAnswer(
  sessionId: string,
  viewerDeviceId: string,
  sdp: string,
): Promise<void> {
  await sessionsCollection().doc(sessionId).update({
    answer: sdp,
    viewerDeviceId,
    status: 'connected',
  });
}

export async function addCandidate(
  sessionId: string,
  candidate: any,
  from: 'camera' | 'viewer',
): Promise<void> {
  await sessionsCollection()
    .doc(sessionId)
    .collection('candidates')
    .add({
      ...candidate,
      from,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}

export function onAnswer(
  sessionId: string,
  callback: (answer: string) => void,
): () => void {
  let handled = false;
  return sessionsCollection()
    .doc(sessionId)
    .onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !handled) {
        handled = true;
        callback(data.answer);
      }
    });
}

export function onOffer(
  sessionId: string,
  callback: (offer: string) => void,
): () => void {
  let handled = false;
  return sessionsCollection()
    .doc(sessionId)
    .onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.offer && !handled) {
        handled = true;
        callback(data.offer);
      }
    });
}

export function onCandidates(
  sessionId: string,
  from: 'camera' | 'viewer',
  callback: (candidate: any) => void,
): () => void {
  return sessionsCollection()
    .doc(sessionId)
    .collection('candidates')
    .where('from', '==', from)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          callback({
            candidate: data.candidate,
            sdpMLineIndex: data.sdpMLineIndex,
            sdpMid: data.sdpMid,
          });
        }
      });
    });
}

export async function closeSession(sessionId: string): Promise<void> {
  await sessionsCollection().doc(sessionId).update({ status: 'closed' });
}

export async function findActiveSession(
  cameraDeviceId: string,
): Promise<string | null> {
  const snapshot = await sessionsCollection()
    .where('cameraDeviceId', '==', cameraDeviceId)
    .where('status', '==', 'waiting')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}
