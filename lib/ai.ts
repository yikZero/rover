import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

export async function generate(prompt: string) {
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt,
  })
  return text
}
