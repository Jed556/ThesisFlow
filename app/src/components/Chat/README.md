# Chat System

A modular, reusable chat component system for ThesisFlow that can be used throughout the application for various communication contexts.

## Overview

The chat system consists of three main components:
- **ChatBox**: Main container that orchestrates the chat experience
- **MessageCard**: Individual message display component
- **ChatInput**: Input field with attachment support

## Components

### ChatBox

The main container component that brings together message display and input functionality.

```tsx
import { ChatBox } from '../components/Chat';

<ChatBox
  messages={chatMessages}
  currentUserId="user@example.com"
  onSendMessage={(message, attachments) => {
    // Handle sending message
  }}
  config={{
    showTimestamps: true,
    showAvatars: true,
    showSenderNames: true,
    showSenderRoles: true,
    allowAttachments: true,
    maxAttachmentSize: 10485760, // 10MB
  }}
  getDisplayName={(senderId) => getDisplayName(senderId)}
  getRoleDisplayText={(senderId) => getRoleDisplayText(senderId)}
  height="600px"
  animationVariant="slideUp"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `messages` | `ChatMessage[]` | required | Array of chat messages |
| `currentUserId` | `string` | required | ID of the current user |
| `onSendMessage` | `(message: string, attachments: ChatAttachment[]) => void` | optional | Callback when a message is sent |
| `config` | `ChatBoxConfig` | defaults | Configuration options |
| `showInput` | `boolean` | `true` | Whether to show input field |
| `height` | `string \| number` | `'600px'` | Height of the chat container |
| `autoScroll` | `boolean` | `true` | Auto-scroll to bottom on new messages |
| `getDisplayName` | `(senderId: string) => string` | optional | Custom display name resolver |
| `getRoleDisplayText` | `(senderId: string, role?: string) => string` | optional | Custom role display resolver |
| `getAvatarColor` | `(senderId: string, role?: string) => string` | optional | Custom avatar color resolver |
| `onAttachmentClick` | `(attachment: ChatAttachment) => void` | optional | Attachment click handler |
| `onMessageClick` | `(message: ChatMessage) => void` | optional | Message click handler |
| `groupByDate` | `boolean` | `false` | Group messages by date |
| `animationVariant` | `'fade' \| 'slideUp' \| 'slideLeft' \| 'scale' \| 'none'` | `'slideUp'` | Animation for messages |
| `animationStaggerDelay` | `number` | `40` | Delay between message animations (ms) |

### MessageCard

Individual message card component with support for attachments and various display options.

```tsx
import { MessageCard } from '../components/Chat';

<MessageCard
  message={chatMessage}
  isUser={message.senderId === currentUserId}
  showAvatar={true}
  showSenderName={true}
  showSenderRole={true}
  showTimestamp={true}
  displayName="John Doe"
  roleDisplayText="Student (Leader)"
  avatarColor="primary.main"
  onAttachmentClick={(attachment) => {
    // Handle attachment click
  }}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `ChatMessage` | required | The message to display |
| `isUser` | `boolean` | required | Whether message is from current user |
| `showAvatar` | `boolean` | `true` | Show sender's avatar |
| `showSenderName` | `boolean` | `true` | Show sender's name |
| `showSenderRole` | `boolean` | `true` | Show sender's role |
| `showTimestamp` | `boolean` | `true` | Show message timestamp |
| `displayName` | `string` | optional | Custom display name |
| `roleDisplayText` | `string` | optional | Custom role text |
| `avatarColor` | `string` | optional | Custom avatar color |
| `onAttachmentClick` | `(attachment: ChatAttachment) => void` | optional | Attachment click handler |
| `onMessageClick` | `(message: ChatMessage) => void` | optional | Message click handler |
| `maxWidth` | `number` | `80` | Max width as percentage |

### ChatInput

Input component with multi-file attachment support.

```tsx
import { ChatInput } from '../components/Chat';

<ChatInput
  onSendMessage={(message, attachments) => {
    // Handle sending message
  }}
  placeholder="Type a message..."
  allowAttachments={true}
  allowedAttachmentTypes={['image', 'video', 'document', 'file']}
  maxAttachmentSize={10485760} // 10MB
  maxAttachments={5}
  onError={(error) => console.error(error)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSendMessage` | `(message: string, attachments: ChatAttachment[]) => void` | required | Callback when message is sent |
| `placeholder` | `string` | `"Type a message..."` | Input placeholder text |
| `allowAttachments` | `boolean` | `true` | Enable attachment support |
| `allowedAttachmentTypes` | `ChatAttachmentType[]` | `['image', 'video', 'document', 'file']` | Allowed file types |
| `maxAttachmentSize` | `number` | `10485760` | Max file size in bytes (10MB) |
| `maxAttachments` | `number` | `5` | Max number of attachments |
| `disabled` | `boolean` | `false` | Disable input |
| `autoFocus` | `boolean` | `false` | Auto-focus on mount |
| `minRows` | `number` | `1` | Min textarea rows |
| `maxRows` | `number` | `4` | Max textarea rows |
| `onError` | `(error: string) => void` | optional | Error handler |

## Types

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: ChatParticipantRole;
  content: string;
  timestamp: string | Date;
  attachments?: ChatAttachment[];
  status?: ChatMessageStatus;
  metadata?: Record<string, any>;
  isEdited?: boolean;
  replyTo?: string;
}
```

### ChatAttachment

```typescript
interface ChatAttachment {
  id: string;
  name: string;
  type: ChatAttachmentType; // 'image' | 'video' | 'audio' | 'document' | 'file'
  size: number; // in bytes
  url?: string;
  mimeType?: string;
  thumbnailUrl?: string;
}
```

### ChatBoxConfig

```typescript
interface ChatBoxConfig {
  showTimestamps?: boolean;
  showAvatars?: boolean;
  showSenderNames?: boolean;
  showSenderRoles?: boolean;
  groupByDate?: boolean;
  groupBySender?: boolean;
  sortOrder?: 'asc' | 'desc';
  allowEditing?: boolean;
  allowDeletion?: boolean;
  allowReplies?: boolean;
  allowAttachments?: boolean;
  allowedAttachmentTypes?: ChatAttachmentType[];
  maxAttachmentSize?: number;
  maxAttachments?: number;
}
```

## Utility Functions

The `chatUtils.ts` file provides helpful utilities:

```typescript
import {
  thesisCommentToChatMessage,
  chatMessageToThesisComment,
  sortMessages,
  groupMessagesByDate,
  filterMessagesBySender,
  searchMessages,
  validateMessageContent
} from '../utils/chatUtils';

// Convert thesis comment to chat message
const chatMessage = thesisCommentToChatMessage(thesisComment, 0);

// Sort messages
const sorted = sortMessages(messages, 'asc');

// Group by date
const grouped = groupMessagesByDate(messages);

// Search messages
const results = searchMessages(messages, 'query string');

// Validate message
const { isValid, error } = validateMessageContent(message, 1, 5000);
```

## Examples

### Basic Chat (No Input)

Perfect for displaying comments or feedback:

```tsx
<ChatBox
  messages={messages}
  currentUserId={currentUser.email}
  showInput={false}
  height="400px"
  config={{
    showTimestamps: true,
    showAvatars: true,
    allowAttachments: false
  }}
/>
```

### Full Chat with Input

For real-time messaging:

```tsx
<ChatBox
  messages={messages}
  currentUserId={currentUser.email}
  onSendMessage={(message, attachments) => {
    // Send message to backend
    sendMessage({ content: message, attachments });
  }}
  config={{
    allowAttachments: true,
    maxAttachments: 3,
    maxAttachmentSize: 5242880 // 5MB
  }}
  height="600px"
/>
```

### Chapter Comments (Thesis Context)

Used in `ChapterComment.tsx`:

```tsx
<ChatBox
  messages={chatMessages}
  currentUserId={currentUserEmail || ''}
  showInput={false}
  height="auto"
  config={{
    showTimestamps: true,
    showAvatars: true,
    showSenderNames: true,
    showSenderRoles: true,
    sortOrder: 'asc',
    allowAttachments: false
  }}
  getDisplayName={(senderId) => getDisplayName(senderId)}
  getRoleDisplayText={(senderId) => getThesisRoleDisplayText(senderId)}
  getAvatarColor={(senderId) => {
    const role = getThesisRole(senderId);
    return role === 'adviser' ? 'primary.main' : 'secondary.main';
  }}
  animationStaggerDelay={40}
  animationVariant="slideUp"
/>
```

## Features

### ✅ Implemented

- **Message Display**: Clean, modern message cards with user alignment
- **Attachments**: Full support for multiple attachment types with previews
- **Animations**: Smooth entrance animations with configurable variants
- **Avatars**: User avatars with role-based colors
- **Timestamps**: Relative and absolute time display
- **Input**: Multi-line text input with Ctrl+Enter to send
- **File Upload**: Drag-and-drop and click-to-upload with validation
- **Type Safety**: Full TypeScript support throughout
- **Modularity**: Reusable across different contexts
- **Accessibility**: ARIA labels and keyboard navigation
- **Material Design 3**: Follows M3 guidelines for transitions and styling

### 🎨 Styling

- User messages: Right-aligned with primary color background
- Other messages: Left-aligned with default background
- Smooth transitions on hover
- Responsive design for mobile and desktop
- M3-compliant animations and easings

### 🔧 Customization

The system is highly customizable through:
- Configuration props
- Custom resolvers for display names, roles, and colors
- Custom click handlers for messages and attachments
- Flexible height and width settings
- Animation variants and timing

## Migration from ChapterComment

The old `ChapterComment` component has been refactored to use `ChatBox`:

**Before**: Custom card-based UI with manual comment rendering
**After**: Uses modular `ChatBox` with automatic message handling

Benefits:
- ✅ Less code duplication
- ✅ Consistent UX across the app
- ✅ Easier to maintain and extend
- ✅ Built-in animations and interactions
- ✅ Better TypeScript support
- ✅ Attachment handling included

## Future Enhancements

Potential additions:
- [ ] Message editing
- [ ] Message deletion
- [ ] Reply threads
- [ ] Emoji reactions
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Voice messages
- [ ] Image/video preview in chat
- [ ] Link preview
- [ ] Markdown support
- [ ] @mentions
- [ ] Search within chat

## Best Practices

1. **Always provide currentUserId**: Required to determine message alignment
2. **Use custom resolvers**: Provide display name and role resolvers for better UX
3. **Handle errors**: Implement `onError` for attachment upload failures
4. **Validate on backend**: Client-side validation is for UX, always validate server-side
5. **Optimize large lists**: Use pagination or virtualization for 100+ messages
6. **Test animations**: Disable animations for testing with `animationVariant="none"`
7. **Accessibility**: Ensure keyboard navigation and screen reader support

## License

Part of ThesisFlow - Research Management System
