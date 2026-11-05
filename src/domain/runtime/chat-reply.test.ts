import { expect, it } from 'vitest';
import { createSession, chatRequest, replyMessage, message } from './chat';
import { savedDocument } from './fixtures.test-support';
import { decodeConversations } from '../../services/conversation-repository';

it('preserves the actual reply driver and model without copying prompts into message metadata', () => {
  const doc = savedDocument();
  const session = createSession('codex-native');
  session.messages.push(message('user', 'private source document'));
  const profile = doc.profiles.find((item) => item.id === session.profileId)!;
  const request = chatRequest(session, profile);
  const reply = replyMessage(
    { status: 'failed', text: '', errorCode: 'cli_model_unavailable', nativeSessionId: null },
    request,
  );
  session.messages.push(reply);
  session.profileId = 'codeagent-native';
  profile.model = 'changed';
  const restored = decodeConversations([session])[0].messages.at(-1)!;
  expect(restored.cli).toEqual({ driver: 'codex', model: 'fixture-model', turnId: request.turnId });
  expect(JSON.stringify(restored.cli)).not.toContain('private source document');
  const invalid = JSON.parse(JSON.stringify([session]));
  invalid[0].messages[1].cli.driver = 'unknown';
  expect(() => decodeConversations(invalid)).toThrow('session_storage_invalid');
});
