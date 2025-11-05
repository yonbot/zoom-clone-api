import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import datasource from './datasource';
import authController from './modules/auth/auth.controller';
import { accountController } from './modules/account/account.controller';
import setCurrentUser from './middleware/set-current-user';
import { Server } from 'socket.io';
import meetingController from './modules/meetings/meeting.controller';

require('dotenv').config();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8888;
const app: Express = express();
const httpServer = createServer(app);

// JSONミドルウェアの設定
app.use(express.json());
app.use(cors());
app.use(setCurrentUser);

// 静的ファイル配信の設定
app.use('/uploads', express.static('uploads'));

// ルートの設定
app.use('/auth', authController);
app.use('/account', accountController);
app.use('/meetings', meetingController);

interface Participant {
  id: string;
  socketId: string;
  name: string;
  voiceOn: boolean;
  cameraOn: boolean;
}

interface Chat {
  id: string;
  message: string;
  userName: string;
  createdAt: Date;
}

interface Meeting {
  id: string;
  hostId: string;
  participants: Participant[];
  chats?: Chat[];
}

let meetings: Meeting[] = [];

const io = new Server(httpServer, {
  cors: {
    origin: '*', // 本番環境では適切なオリジンに変更してください
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('クライアント接続: ', socket.id);

  socket.on('join-meeting', (meetingId: string, participant: Participant) => {
    // 前提、meetingIdを一旦APIに投げて、userの情報やミーティングがアクティブかどうかを確認した上でAPIからsocketに接続する
    console.log('join-meeting', meetingId, participant);
    socket.join(meetingId);
    if (meetings.find((meeting) => meeting.id === meetingId) == null) {
      meetings.push({
        id: meetingId,
        hostId: participant.id,
        participants: [{ ...participant }],
      });
    }
    const meeting = meetings.find((meeting) => meeting.id === meetingId);
    if (meeting == null) {
      return;
    }

    // 同じIDの参加者がすでに存在する場合は参加を拒否
    if (meeting.participants.some((p) => p.id === participant.id)) {
      return;
    }

    if (meeting.participants.length >= 2) {
      return;
    }

    meeting.participants.push({ ...participant, socketId: socket.id });

    io.to(meetingId).emit('participant-joined', {
      meetingId,
      participants: meeting.participants.map((participant) => ({
        ...participant,
        isHost: participant.id === meeting.hostId,
      })),
      chats: meeting.chats,
    });
  });
  socket.on('leave-meeting', async (meetingId: string, userId: string) => {
    console.log('leave-meeting', meetingId, userId);
    socket.leave(meetingId);

    const meeting = meetings.find((meeting) => meeting.id === meetingId);
    if (meeting == null) {
      return;
    }

    // ホストが退室する場合、ミーティングを非アクティブにする
    const isHost = meeting.hostId === userId;
    if (isHost) {
      await closeMeeting(meetingId);
      return;
    }

    meeting.participants = meeting.participants.filter(
      (participant) => participant.id !== userId
    );

    // 残りの参加者にユーザーが退出したことを通知
    socket.to(meetingId).emit('participant-left', {
      meetingId,
      leftParticipantId: userId,
      isHostLeft: false, // ホストの場合は早期リターンするためここは常にfalse
    });
  });
  socket.on(
    'update-participant',
    (meetingId: string, participant: Participant) => {
      console.log('update-participant', meetingId, participant);
      const meeting = meetings.find((meeting) => meeting.id === meetingId);
      if (meeting == null) {
        return;
      }
      meeting.participants = meeting.participants.map((p) =>
        p.id === participant.id ? { ...participant, socketId: socket.id } : p
      );
      socket.to(meetingId).emit('participant-updated', {
        meetingId,
        participant: {
          ...participant,
          isHost: participant.id == meeting.hostId,
        },
      });
    }
  );
  socket.on(
    'send-chat',
    (meetingId: string, message: string, userName: string) => {
      console.log('send-chat', meetingId, message, userName);

      if (!message || message.trim().length === 0) {
        console.log('空のメッセージは送信できません');
        return;
      }

      if (message.trim().length > 1000) {
        console.log('メッセージが長すぎます (最大1000文字)');
        return;
      }

      if (!userName || userName.trim().length === 0) {
        console.log('ユーザー名が必要です');
        return;
      }

      const meeting = meetings.find((meeting) => meeting.id === meetingId);
      if (meeting == null) {
        console.log('ミーティングが見つかりません:', meetingId);
        return;
      }

      const chat: Chat = {
        id: Date.now().toString(),
        message: message.trim(),
        userName: userName.trim(),
        createdAt: new Date(),
      };

      if (!meeting.chats) {
        meeting.chats = [];
      }
      meeting.chats.push(chat);

      io.to(meetingId).emit('receive-chat', chat);
    }
  );

  socket.on('disconnect', async () => {
    console.log('disconnect', socket.id);

    const meeting = meetings.find((meeting) =>
      meeting.participants.some(
        (participant) => participant.socketId === socket.id
      )
    );
    if (meeting == null) {
      return;
    }

    for (const meeting of meetings) {
      const participant = meeting.participants.find(
        (participant) => participant.socketId === socket.id
      );
      if (participant == null) {
        continue;
      }

      if (meeting.hostId === participant.id) {
        await closeMeeting(meeting.id);
        break; // ホストの場合はミーティングが終了するので処理を終了
      } else {
        // 通常の参加者の場合は参加者リストから削除
        meeting.participants = meeting.participants.filter(
          (participant) => participant.socketId !== socket.id
        );

        socket.to(meeting.id).emit('participant-left', {
          meetingId: meeting.id,
          leftParticipantId: participant.id,
        });
      }
    }
  });
});

const closeMeeting = async (meetingId: string) => {
  try {
    console.log(
      'ホストが退室しました。ミーティングを非アクティブにします:',
      meetingId
    );

    // ミーティングの全参加者に終了通知を送信
    io.to(meetingId).emit('close', {
      meetingId,
    });

    // ミーティングルームにいる全てのソケットを退室させる
    const socketsInRoom = await io.in(meetingId).fetchSockets();
    for (const socket of socketsInRoom) {
      socket.leave(meetingId);
    }

    // meetings配列からミーティングを削除
    const meetingIndex = meetings.findIndex(
      (meeting) => meeting.id === meetingId
    );
    if (meetingIndex !== -1) {
      meetings.splice(meetingIndex, 1);
    }

    console.log('ミーティングが正常に終了しました:', meetingId);
  } catch (error) {
    console.error('ミーティング終了処理でエラーが発生しました:', error);
  }
};

datasource
  .initialize()
  .then(async (connection) => {
    httpServer.listen(port, () =>
      console.log(`Server listening on port ${port}!`)
    );
  })
  .catch((error) => console.error(error));

app.get('/', (req: Request, res: Response) => {
  res.send('hello world');
});
