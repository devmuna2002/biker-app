import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  Animated,
  Image,
  PermissionsAndroid,
} from 'react-native';
import { Text, Avatar, IconButton, useTheme, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import SheetService from '../api/SheetService';
import CallService from '../api/CallService';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bi } from '../components/AppIcon';

const AudioMessage = ({ audioUri, mine }) => {
  const theme = useTheme();
  const player = useAudioPlayer(audioUri);

  return (
    <View style={styles.audioContainer}>
      <TouchableOpacity
        style={styles.audioPlayButton}
        onPress={() => {
          if (player.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
      >
        <IconButton
          icon={bi(player.playing ? 'pause' : 'play')}
          size={20}
          iconColor={mine ? "#000" : "#2ECC71"}
          style={{ margin: 0 }}
        />
      </TouchableOpacity>
      <Text style={[styles.audioDuration, { color: mine ? '#000' : '#FFF' }]}>
        {player.playing ? 'Playing...' : 'Audio'}
      </Text>
    </View>
  );
};

const ChatScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const recipientName = route?.params?.recipientName || 'User';
  const recipientRole = route?.params?.recipientRole || 'user';
  const orderId = route?.params?.orderId;
  const recipientPhone = route?.params?.recipientPhone;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isCalling, setIsCalling] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [recipientId, setRecipientId] = useState(route?.params?.recipientId);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const myId = SheetService.currentUser?.id?.toString();
  const myName = SheetService.currentUser?.name || 'Me';
  const typingTimeout = useRef(null);
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Animated typing dots
  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.stopAnimation();
    }
  }, [isTyping]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const socket = await SheetService.connectTrackingSocket();
        if (!active || !socket) return;
        socketRef.current = socket;
        setConnectionStatus(socket.connected ? 'connected' : 'disconnected');

        socket.on('connect', () => { if (active) setConnectionStatus('connected'); });
        socket.on('disconnect', () => { if (active) setConnectionStatus('disconnected'); });

        // Register user identity so backend knows who we are
        if (myId) {
          socket.emit('register', { userId: myId, userType: 'chat' });
        }

        // Subscribe to the chat room
        const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
        socket.emit('join_chat', { room, userId: myId, orderId });

        socket.on('new_message', (msg) => {
          if (!active) return;
          // Accept messages for our room
          const normalized = {
            id: msg.id || `m-${Date.now()}-${Math.random()}`,
            text: msg.text || msg.message || undefined,
            image: msg.image || undefined,
            audio: msg.audio || undefined,
            type: msg.type || (msg.image ? 'image' : msg.audio ? 'audio' : undefined),
            senderId: msg.senderId?.toString(),
            senderName: msg.senderName || recipientName,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            delivered: true,
          };
          setMessages(prev => {
            if (prev.find(m => m.id === normalized.id)) return prev;
            return [...prev, normalized];
          });
        });

        socket.on('user_typing', ({ senderId }) => {
          if (!active || senderId?.toString() === myId) return;
          setIsTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setIsTyping(false), 2500);
        });

        // Load message history from REST API
        try {
          const historyRes = await SheetService.getChatHistory({ orderId, room });
          if (!active) return;
          const history = (historyRes?.data?.messages || []).map(m => ({
            id: m.id?.toString(),
            text: m.text || m.message || undefined,
            image: m.image || undefined,
            audio: m.audio || undefined,
            type: m.type || undefined,
            senderId: m.senderId?.toString(),
            senderName: m.senderName,
            timestamp: new Date(m.timestamp || m.createdAt),
            delivered: true,
          }));
          if (history.length > 0) setMessages(history);
        } catch {
          // No history yet
        }

        // System welcome message
        const welcomeText = orderId
          ? `Chat with ${recipientName} for Order #${orderId}`
          : `You're chatting with ${recipientName}. Type your message below.`;
        setMessages(prev => prev.length === 0 ? [{
          id: 'sys-0',
          text: welcomeText,
          senderId: 'system',
          senderName: 'System',
          timestamp: new Date(),
          delivered: true,
          isSystem: true,
        }] : prev);

      } catch (e) {
        console.log('[ChatScreen] Socket init error:', e?.message);
        if (active) setConnectionStatus('error');
      }
    };

    init();
    return () => {
      active = false;
      clearTimeout(typingTimeout.current);
    };
  }, [orderId, myId, recipientName]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');

    const optimistic = {
      id: `local-${Date.now()}`,
      text,
      senderId: myId,
      senderName: myName,
      timestamp: new Date(),
      delivered: false,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat_message', {
          room,
          orderId,
          text,
          senderId: myId,
          senderName: myName,
        });
      }

      await SheetService.sendChatMessage({
        orderId,
        text,
        senderName: myName,
      });

      setMessages(prev =>
        prev.map(m => m.id === optimistic.id ? { ...m, delivered: true } : m)
      );
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === optimistic.id ? { ...m, failed: true } : m)
      );
    }
  };

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const audio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return camera === 'granted' && audio === 'granted';
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Pick image from gallery
  const pickImage = async () => {
    setShowMediaOptions(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const message = {
          id: `local-${Date.now()}`,
          image: asset.uri,
          senderId: myId,
          senderName: myName,
          timestamp: new Date(),
          delivered: false,
          type: 'image'
        };
        setMessages(prev => [...prev, message]);

        // Send via socket
        const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat_media', {
            room,
            orderId,
            mediaType: 'image',
            mediaUri: asset.uri,
            senderId: myId,
            senderName: myName,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    setShowMediaOptions(false);
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission needed', 'Camera and microphone permissions are required');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const message = {
          id: `local-${Date.now()}`,
          image: asset.uri,
          senderId: myId,
          senderName: myName,
          timestamp: new Date(),
          delivered: false,
          type: 'image'
        };
        setMessages(prev => [...prev, message]);

        // Send via socket
        const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat_media', {
            room,
            orderId,
            mediaType: 'image',
            mediaUri: asset.uri,
            senderId: myId,
            senderName: myName,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not take photo');
    }
  };

  // Start audio recording
  const startRecording = async () => {
    setShowMediaOptions(false);
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission needed', 'Microphone permission is required to record audio');
      return;
    }

    try {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      recorder.record();
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  // Stop audio recording
  const stopRecording = async () => {
    if (!recorder.isRecording) return;

    try {
      setIsRecording(false);
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        const message = {
          id: `local-${Date.now()}`,
          audio: uri,
          senderId: myId,
          senderName: myName,
          timestamp: new Date(),
          delivered: false,
          type: 'audio'
        };
        setMessages(prev => [...prev, message]);

        // Send via socket
        const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
        if (socketRef.current?.connected) {
          socketRef.current.emit('chat_media', {
            room,
            orderId,
            mediaType: 'audio',
            mediaUri: uri,
            senderId: myId,
            senderName: myName,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not stop recording');
    }
  };

  const handleTyping = (text) => {
    setInputText(text);
    if (socketRef.current?.connected) {
      const room = orderId ? `chat_${orderId}` : `chat_support_${myId}`;
      socketRef.current.emit('user_typing', {
        room,
        senderId: myId,
      });
    }
  };

  const handleCall = async () => {
    const phone = recipientPhone || route?.params?.customerPhone;
    if (phone) {
      Alert.alert(
        'Call',
        `Call ${recipientName} at ${phone}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call 📞',
            onPress: () => {
              SheetService.recordCall({
                orderId,
                phoneNumber: phone,
                name: recipientName,
                type: 'outgoing',
              }).catch(() => { });

              Linking.openURL(`tel:${phone}`).catch(() => {
                Alert.alert('Error', 'Could not make call');
              });
            }
          },
        ]
      );
    } else {
      Alert.alert('No Phone Number', `${recipientName}'s phone number is not available for this order.`);
    }
  };

  const handleEndCall = () => {
    CallService.endCall();
    setIsCalling(false);
    setCallState('idle');
  };

  const isMe = (msg) => msg.senderId?.toString() === myId?.toString();

  const formatTime = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item: msg }) => {
    if (msg.isSystem) {
      return (
        <View style={styles.systemMsgWrapper}>
          <Text style={styles.systemMsg}>{msg.text}</Text>
        </View>
      );
    }

    const mine = isMe(msg);

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowThem]}>
        {!mine && (
          <Avatar.Text
            size={28}
            label={(msg.senderName || 'U')[0].toUpperCase()}
            style={styles.avatar}
          />
        )}
        <View
          style={[
            styles.bubble,
            mine ? [styles.bubbleMe, { backgroundColor: '#2ECC71' }] : [styles.bubbleThem, { backgroundColor: theme.colors.surface }],
            msg.failed && { opacity: 0.5 },
          ]}
        >
          {/* Image message */}
          {msg.type === 'image' && msg.image && (
            <TouchableOpacity onPress={() => {
              if (msg.image) {
                // Could open full screen image viewer here
              }
            }}>
              <Image source={{ uri: msg.image }} style={styles.messageImage} resizeMode="cover" />
            </TouchableOpacity>
          )}

          {/* Audio message */}
          {msg.type === 'audio' && msg.audio && (
            <AudioMessage audioUri={msg.audio} mine={mine} />
          )}

          {/* Text message */}
          {msg.text && (
            <>
              {!mine && (
                <Text style={styles.senderLabel}>{msg.senderName || recipientName}</Text>
              )}
              <Text style={[styles.bubbleText, { color: mine ? '#000' : theme.colors.text }]}>{msg.text}</Text>
            </>
          )}

          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, { color: mine ? 'rgba(0,0,0,0.5)' : '#7F8C8D' }]}>{formatTime(msg.timestamp)}</Text>
            {mine && (
              <Text style={styles.bubbleStatus}>
                {msg.failed ? ' ✗' : msg.delivered ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <IconButton
            icon={bi('arrow-left')}
            size={24}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                const home = SheetService.currentUser?.role === 'biker' ? 'BikerApp' : 'MainApp';
                navigation.navigate(home);
              }
            }}
            iconColor={theme.colors.text}
          />
          <View style={styles.recipientInfo}>
            <Avatar.Text
              size={38}
              label={(recipientName[0] || 'U').toUpperCase()}
              style={{ backgroundColor: '#2ECC71' }}
              color="#000"
            />
            <View style={styles.recipientTextBlock}>
              <Text style={[styles.recipientName, { color: theme.colors.text }]}>{recipientName}</Text>
              <Text style={[styles.recipientStatus, {
                color: connectionStatus === 'connected' ? '#2ECC71'
                  : connectionStatus === 'connecting' ? '#F39C12' : '#E74C3C',
              }]}>
                {connectionStatus === 'connected' ? '● Online' : connectionStatus === 'connecting' ? '● Connecting...' : '● Offline'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
            <IconButton icon={bi('phone')} size={24} iconColor="#2ECC71" style={{ margin: 0 }} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isTyping ? (
              <Animated.View style={[styles.typingWrapper, { opacity: typingAnim }]}>
                <Avatar.Text size={28} label={recipientName[0]?.toUpperCase() || 'U'} style={{ backgroundColor: '#333' }} />
                <View style={[styles.bubble, styles.bubbleThem, { backgroundColor: theme.colors.surface, marginLeft: 8, paddingVertical: 12 }]}>
                  <Text style={{ color: '#7F8C8D', fontSize: 13 }}>
                    {recipientName} is typing...
                  </Text>
                </View>
              </Animated.View>
            ) : null
          }
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <IconButton icon={bi('image-plus')} size={22} iconColor="#7F8C8D" style={{ margin: 0 }} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { color: theme.colors.text, borderColor: theme.colors.outline }]}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="#555"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />

          {/* Media buttons */}
          <View style={styles.mediaButtons}>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => setShowMediaOptions(!showMediaOptions)}
            >
              <IconButton icon={bi('plus-circle')} size={24} iconColor="#2ECC71" style={{ margin: 0 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: inputText.trim() ? '#2ECC71' : '#252525' }]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <IconButton icon={bi('send')} size={20} iconColor={inputText.trim() ? '#000' : '#555'} style={{ margin: 0 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Media options popup */}
        {showMediaOptions && (
          <View style={styles.mediaOptionsPopup}>
            <TouchableOpacity style={styles.mediaOption} onPress={takePhoto}>
              <IconButton icon={bi('camera')} size={28} iconColor="#FFF" style={{ margin: 0, backgroundColor: '#2ECC71', borderRadius: 20 }} />
              <Text style={styles.mediaOptionText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mediaOption} onPress={pickImage}>
              <IconButton icon={bi('image')} size={28} iconColor="#FFF" style={{ margin: 0, backgroundColor: '#3498DB', borderRadius: 20 }} />
              <Text style={styles.mediaOptionText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaOption}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <IconButton
                icon={bi(isRecording ? 'stop-circle' : 'microphone')}
                size={28}
                iconColor="#FFF"
                style={{ margin: 0, backgroundColor: isRecording ? '#E74C3C' : '#9B59B6', borderRadius: 20 }}
              />
              <Text style={styles.mediaOptionText}>{isRecording ? 'Stop' : 'Voice'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* In-Call Overlay */}
      {isCalling && (
        <View style={styles.callOverlay}>
          <View style={styles.callCard}>
            <Avatar.Icon size={80} icon={bi('phone')} style={{ backgroundColor: '#2ECC71' }} />
            <Text style={styles.callName}>{recipientName}</Text>
            <Text style={styles.callStatus}>
              {callState === 'calling' ? 'Calling...' :
                callState === 'connected' ? 'Connected' :
                  callState === 'busy' ? 'Line Busy' : 'Connecting...'}
            </Text>
            <View style={styles.callActions}>
              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
                <IconButton icon={bi('phone-hangup')} size={32} iconColor="#FFF" style={{ margin: 0 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    elevation: 4,
  },
  recipientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  recipientTextBlock: {
    marginLeft: 10,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  recipientStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  callBtn: {
    backgroundColor: 'rgba(46,204,113,0.10)',
    borderRadius: 30,
    marginRight: 8,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  systemMsgWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMsg: {
    fontSize: 12,
    color: '#7F8C8D',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    textAlign: 'center',
  },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  avatar: { marginRight: 8, marginBottom: 4 },
  senderLabel: { fontSize: 11, color: '#7F8C8D', marginBottom: 3, fontWeight: '700' },
  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 18,
    elevation: 2,
  },
  bubbleMe: {
    borderBottomRightRadius: 5,
    marginLeft: 40,
  },
  bubbleThem: {
    borderBottomLeftRadius: 5,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    alignItems: 'center',
  },
  bubbleTime: {
    fontSize: 10,
  },
  bubbleStatus: {
    fontSize: 10,
    color: '#2ECC71',
    marginLeft: 2,
  },
  typingWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  attachBtn: {
    padding: 4,
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    fontSize: 15,
    lineHeight: 21,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaOptionsPopup: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    justifyContent: 'space-around',
  },
  mediaOption: {
    alignItems: 'center',
    padding: 8,
  },
  mediaOptionText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDuration: {
    fontSize: 14,
    marginLeft: 8,
  },
  callOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  callCard: {
    alignItems: 'center',
    padding: 30,
  },
  callName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  callStatus: {
    color: '#AAA',
    fontSize: 16,
    marginTop: 10,
  },
  callActions: {
    flexDirection: 'row',
    marginTop: 30,
  },
  endCallBtn: {
    backgroundColor: '#E74C3C',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
