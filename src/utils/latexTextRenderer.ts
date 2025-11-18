/**
 * 解析混合的文本和 LaTeX 内容
 * 支持格式：
 * - $...$ 行内公式
 * - $$...$$ 块级公式
 * - <latex>...</latex> 标签
 */
export interface ParsedContent {
  type: 'text' | 'latex-inline' | 'latex-block'
  content: string
}

export function parseLatexText(html: string): ParsedContent[] {
  const result: ParsedContent[] = []
  if (!html) return result
  
  // 先处理 <latex>...</latex> 标签
  let processedHtml = html
  const latexTagRegex = /<latex>([^<]+)<\/latex>/gi
  processedHtml = processedHtml.replace(latexTagRegex, (match, content) => {
    return `$$${content.trim()}$$`
  })
  
  // 先处理 $$...$$ 块级公式
  const blockFormulaRegex = /\$\$([^$]+)\$\$/g
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
  
  // 对每个部分处理行内公式
  for (const part of parts) {
    if (part.type === 'latex-block') {
      result.push({ type: 'latex-block', content: part.content })
    } else {
      // 处理行内公式
      const inlineFormulaRegex = /\$([^$]+)\$/g
      let inlineLastIndex = 0
      let inlineMatch: RegExpExecArray | null
      const text = part.content
      
      while ((inlineMatch = inlineFormulaRegex.exec(text)) !== null) {
        // 添加公式前的文本
        if (inlineMatch.index > inlineLastIndex) {
          const textBefore = text.substring(inlineLastIndex, inlineMatch.index)
          if (textBefore) {
            result.push({ type: 'text', content: textBefore })
          }
        }
        
        // 添加行内公式
        result.push({ type: 'latex-inline', content: inlineMatch[1].trim() })
        inlineLastIndex = inlineMatch.index + inlineMatch[0].length
      }
      
      // 添加剩余的文本
      if (inlineLastIndex < text.length) {
        const textAfter = text.substring(inlineLastIndex)
        if (textAfter) {
          result.push({ type: 'text', content: textAfter })
        }
      }
    }
  }
  
  // 如果没有匹配到任何公式，返回整个内容作为文本
  if (result.length === 0) {
    result.push({ type: 'text', content: html })
  }
  
  return result
}

/**
 * 将 HTML 内容转换为纯文本，保留 LaTeX 标记
 */
export function htmlToLatexText(html: string): string {
  if (!html) return ''
  
  // 创建一个临时 DOM 元素来解析 HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // 递归提取文本内容，保留 LaTeX 标记
  function extractText(node: Node): string {
    let text = ''
    
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      if (tagName === 'latex') {
        // LaTeX 标签转换为 $...$ 格式
        text += `$${element.textContent || ''}$`
      } else if (tagName === 'br') {
        text += '\n'
      } else if (tagName === 'p' || tagName === 'div') {
        // 段落和 div 标签，处理子节点
        for (let i = 0; i < element.childNodes.length; i++) {
          text += extractText(element.childNodes[i])
        }
      } else {
        // 其他标签，只提取文本内容
        for (let i = 0; i < element.childNodes.length; i++) {
          text += extractText(element.childNodes[i])
        }
      }
    }
    
    return text
  }
  
  let result = ''
  for (let i = 0; i < tempDiv.childNodes.length; i++) {
    const node = tempDiv.childNodes[i]
    result += extractText(node)
    
    // 在段落之间添加换行
    if (i < tempDiv.childNodes.length - 1) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName.toLowerCase()
        if (tagName === 'p' || tagName === 'div') {
          result += '\n'
        }
      }
    }
  }
  
  return result
}

/**
 * 将纯文本（包含 LaTeX 标记）转换为 HTML
 */
export function latexTextToHtml(text: string): string {
  if (!text) return ''
  
  let html = text
  
  // 先处理块级公式 $$...$$，需要处理多行情况
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
    return `<latex>${content.trim()}</latex>`
  })
  
  // 处理行内公式 $...$，确保不会匹配到块级公式的内容
  html = html.replace(/\$([^$\n]+?)\$/g, (match, content) => {
    // 确保不是块级公式的一部分
    if (match.includes('\n')) return match
    return `<latex>${content.trim()}</latex>`
  })
  
  // 将换行符转换为 <br>，但保留段落结构
  const lines = html.split('\n')
  const paragraphs: string[] = []
  let currentParagraph = ''
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      // 空行，结束当前段落
      if (currentParagraph) {
        paragraphs.push(`<p>${currentParagraph}</p>`)
        currentParagraph = ''
      }
    } else {
      // 非空行，添加到当前段落
      if (currentParagraph) {
        currentParagraph += '<br>' + trimmedLine
      } else {
        currentParagraph = trimmedLine
      }
    }
  }
  
  // 添加最后一个段落
  if (currentParagraph) {
    paragraphs.push(`<p>${currentParagraph}</p>`)
  }
  
  // 如果没有段落，返回原始内容（可能只包含 LaTeX）
  if (paragraphs.length === 0) {
    return html || ''
  }
  
  return paragraphs.join('')
}

