import type { ChatContextMode } from './chat-context';

export interface ComposerDraft {
  editDesign?: boolean;
  text: string;
  invoke: boolean;
  profileId: string;
  frameworkId: string;
  useNodeBindings: boolean;
  contextMode: ChatContextMode;
}

export function emptyComposerDraft(profileId: string): ComposerDraft {
  return {
    text: '',
    invoke: false,
    profileId,
    frameworkId: '',
    useNodeBindings: false,
    contextMode: 'recent',
  };
}

export const composerDraftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'invoke', 'profileId', 'frameworkId', 'useNodeBindings', 'contextMode'],
  properties: {
    editDesign: { type: 'boolean' },
    text: { type: 'string', maxLength: 40000 },
    invoke: { type: 'boolean' },
    profileId: { type: 'string', maxLength: 200 },
    frameworkId: { type: 'string', maxLength: 200 },
    useNodeBindings: { type: 'boolean' },
    contextMode: { enum: ['recent', 'current', 'full'] },
  },
};
