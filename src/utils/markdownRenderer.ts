import { marked } from 'marked'

/**
 * 解析混合的 markdown 和 LaTeX 内容
 * 支持格式：
 * - $...$ 行内公式
 * - $$...$$ 块级公式
 * - <latex>...</latex> 标签
 * - Markdown 语法（标题、列表、粗体、斜体等）
 */
export interface ParsedMarkdownContent {
  type: 'text' | 'latex-inline' | 'latex-block' | 'markdown'
  content: string
}

/**
 * 解析 markdown 和 latex 混排内容
 * 先提取 latex 部分，然后对剩余部分进行 markdown 渲染
 */
export function parseMarkdownWithLatex(html: string): ParsedMarkdownContent[] {
  const result: ParsedMarkdownContent[] = []
  if (!html) return result
  
  // 先处理 <latex>...</latex> 标签，转换为 $$...$$ 格式
  let processedHtml = html
  const latexTagRegex = /<latex>([^<]+)<\/latex>/gi
  processedHtml = processedHtml.replace(latexTagRegex, (match, content) => {
    return `$$${content.trim()}$$`
  })
  
  // 先处理 $$...$$ 块级公式
  const blockFormulaRegex = /\$\$([\s\S]*?)\$\$/g
  const parts: Array<{ type: 'text' | 'latex-block', content: string, index: number }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  // 处理块级公式
  while ((match = blockFormulaRegex.exec(processedHtml)) !== null) {
    // 添加公式前的文本
    if (match.index > lastIndex) {
      const textBefore = processedHtml.substring(lastIndex, match.index)
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore, index: match.index })
      }
    }
    
    // 添加公式
    parts.push({ type: 'latex-block', content: match[1].trim(), index: match.index })
    lastIndex = match.index + match[0].length
  }
  
  // 添加最后的文本
  if (lastIndex < processedHtml.length) {
    const textAfter = processedHtml.substring(lastIndex)
    if (textAfter) {
      parts.push({ type: 'text', content: textAfter, index: processedHtml.length })
    }
  }
  
  // 如果没有块级公式，处理整个文本
  if (parts.length === 0) {
    parts.push({ type: 'text', content: processedHtml, index: 0 })
  }
  
  // 对每个部分处理行内公式和 markdown
  for (const part of parts) {
    if (part.type === 'latex-block') {
      result.push({ type: 'latex-block', content: part.content })
    }
    else {
      // 处理行内公式和 markdown
      const text = part.content
      
      // 先提取行内公式 $...$（但不包括 $$...$$）
      // 使用更简单的方式：先匹配所有 $...$，然后过滤掉 $$...$$ 的情况
      const inlineFormulaRegex = /\$([^$\n]+?)\$/g
      const textParts: Array<{ type: 'text' | 'latex-inline', content: string, index: number }> = []
      let inlineLastIndex = 0
      let inlineMatch: RegExpExecArray | null
      
      while ((inlineMatch = inlineFormulaRegex.exec(text)) !== null) {
        // 添加公式前的文本
        if (inlineMatch.index > inlineLastIndex) {
          const textBefore = text.substring(inlineLastIndex, inlineMatch.index)
          if (textBefore) {
            textParts.push({ type: 'text', content: textBefore, index: inlineMatch.index })
          }
        }
        
        // 添加行内公式
        textParts.push({ type: 'latex-inline', content: inlineMatch[1].trim(), index: inlineMatch.index })
        inlineLastIndex = inlineMatch.index + inlineMatch[0].length
      }
      
      // 添加剩余的文本
      if (inlineLastIndex < text.length) {
        const textAfter = text.substring(inlineLastIndex)
        if (textAfter) {
          textParts.push({ type: 'text', content: textAfter, index: text.length })
        }
      }
      
      // 如果没有行内公式，整个文本作为 markdown
      if (textParts.length === 0) {
        result.push({ type: 'markdown', content: text })
      }
      else {
        // 将文本部分渲染为 markdown，保留 latex 部分
        for (const textPart of textParts) {
          if (textPart.type === 'latex-inline') {
            result.push({ type: 'latex-inline', content: textPart.content })
          }
          else {
            // 渲染 markdown
            result.push({ type: 'markdown', content: textPart.content })
          }
        }
      }
    }
  }
  
  // 如果没有匹配到任何公式，整个内容作为 markdown
  if (result.length === 0) {
    result.push({ type: 'markdown', content: html })
  }
  
  return result
}

/**
 * 将 markdown 内容渲染为 HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  
  try {
    // marked v17 使用 marked() 函数，配置通过 marked.use() 或 marked.setOptions()
    // 为了兼容性，直接使用 marked.parse()
    return marked.parse(markdown, {
      breaks: true, // 支持换行
      gfm: true, // GitHub Flavored Markdown
    }) as string
  }
  catch (error) {
    console.error('Markdown rendering error:', error)
    return markdown // 如果渲染失败，返回原始内容
  }
}

/**
 * 解析纯 markdown 内容（不包含 latex）
 */
export function parseMarkdown(html: string): string {
  if (!html) return ''
  
  // 如果内容已经是 HTML，直接返回
  if (html.trim().startsWith('<')) {
    return html
  }
  
  // 否则作为 markdown 渲染
  return renderMarkdown(html)
}

