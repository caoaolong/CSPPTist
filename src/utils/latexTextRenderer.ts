/**
 * 解析混合的文本和 LaTeX 内容
 * 支持格式：
 * - $...$ 行内公式
 * - $$...$$ 块级公式
 * - <latex>...</latex> 标签
 * - Markdown 语法（标题、列表、粗体、斜体等）
 */
export interface ParsedContent {
  type: 'text' | 'latex-inline' | 'latex-block' | 'markdown'
  content: string
}

/**
 * 检测文本是否包含 markdown 语法
 */
function hasMarkdownSyntax(text: string): boolean {
  if (!text || !text.trim()) return false

  // 检测常见的 markdown 语法
  const markdownPatterns = [
    /^#{1,6}\s/, // 标题 # ## ###
    /^[-*+]\s/, // 无序列表 - * +
    /^\d+\.\s/, // 有序列表 1. 2.
    /\*\*[^*]+\*\*/, // 粗体 **text**
    /__[^_]+__/, // 粗体 __text__
    /\*[^*]+\*/, // 斜体 *text*
    /_[^_]+_/, // 斜体 _text_
    /`[^`]+`/, // 行内代码 `code`
    /\[.+\]\(.+\)/, // 链接 [text](url)
    /!\[.+\]\(.+\)/, // 图片 ![alt](url)
    /^>\s/, // 引用 > text
    /^---+$/, // 水平线 ---
    /^\*\*\*+$/, // 水平线 ***
    /\|.+\|/, // 表格 | col1 | col2 |
    /^```[\s\S]*?```$/m, // 代码块 ```code```
  ]

  return markdownPatterns.some(pattern => pattern.test(text))
}

/**
 * 转义 HTML 特殊字符并处理换行符
 */
export function escapeHtmlAndNewlines(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}

export function parseLatexText(html: string): ParsedContent[] {
  const result: ParsedContent[] = []
  if (!html) return result

  // 递归提取文本，保留 $ 和 $$ 标记
  function extractTextWithLatex(node: Node): string {
    let text = ''

    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    }
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      if (tagName === 'latex') {
        // LaTeX 标签转换为 $$...$$ 格式（块级）
        text += `$$${(element.textContent || '').trim()}$$`
      }
      else if (tagName === 'latex-inline') {
        // 行内公式标签转换为 $...$ 格式
        text += `$${(element.textContent || '').trim()}$`
      }
      else if (tagName === 'br') {
        text += '\n'
      }
      else {
        // 其他标签，递归处理子节点
        for (let i = 0; i < element.childNodes.length; i++) {
          text += extractTextWithLatex(element.childNodes[i])
        }
      }
    }

    return text
  }

  // 如果内容是 HTML，先提取文本内容（保留 $ 和 $$ 标记）
  let processedHtml = html
  if (html.trim().startsWith('<')) {
    // 是 HTML 格式，提取文本内容
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    processedHtml = ''
    for (let i = 0; i < tempDiv.childNodes.length; i++) {
      processedHtml += extractTextWithLatex(tempDiv.childNodes[i])
      if (i < tempDiv.childNodes.length - 1) {
        processedHtml += '\n'
      }
    }
  }

  // 处理 <latex-inline>...</latex-inline> 标签（行内公式）
  const latexInlineTagRegex = /<latex-inline>([^<]+)<\/latex-inline>/gi
  processedHtml = processedHtml.replace(latexInlineTagRegex, (match, content) => {
    return `$${content.trim()}$`
  })

  // 处理 <latex>...</latex> 标签（块级公式）
  const latexTagRegex = /<latex>([^<]+)<\/latex>/gi
  processedHtml = processedHtml.replace(latexTagRegex, (match, content) => {
    return `$$${content.trim()}$$`
  })

  // 先处理 $$...$$ 块级公式（支持多行）
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
      // 处理行内公式（不包括 $$...$$）
      const text = part.content

      // 使用临时标记替换块级公式，避免行内公式匹配错误
      const blockPlaceholders: string[] = []
      let placeholderIndex = 0
      const textWithPlaceholders = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        const placeholder = `__BLOCK_PLACEHOLDER_${placeholderIndex}__`
        blockPlaceholders[placeholderIndex] = match
        placeholderIndex++
        return placeholder
      })

      // 优化行内公式匹配：匹配 $...$ 但排除 $$...$$ 的情况
      // 使用负向前瞻和负向后顾来确保不是 $$...$$ 的一部分
      // 匹配模式：前面不是 $，后面也不是 $ 的 $...$ 模式
      const inlineFormulaRegex = /\$(?![$])([^$\n]+?)\$(?![$])/g
      let inlineLastIndex = 0
      let inlineMatch: RegExpExecArray | null
      let hasInlineFormula = false

      while ((inlineMatch = inlineFormulaRegex.exec(textWithPlaceholders)) !== null) {
        // 检查是否是占位符的一部分
        const matchText = inlineMatch[0]
        if (matchText.includes('__BLOCK_PLACEHOLDER')) {
          continue
        }

        // 额外检查：确保前后字符不是 $（双重保险）
        const matchIndex = inlineMatch.index
        const prevChar = matchIndex > 0 ? textWithPlaceholders[matchIndex - 1] : ''
        const nextCharIndex = matchIndex + inlineMatch[0].length
        const nextChar = nextCharIndex < textWithPlaceholders.length ? textWithPlaceholders[nextCharIndex] : ''

        // 如果前后都是 $，则跳过（这是块级公式的一部分，虽然理论上不应该出现）
        if (prevChar === '$' || nextChar === '$') {
          continue
        }

        hasInlineFormula = true

        // 添加公式前的文本
        if (inlineMatch.index > inlineLastIndex) {
          let textBefore = textWithPlaceholders.substring(inlineLastIndex, inlineMatch.index)
          // 恢复占位符
          blockPlaceholders.forEach((placeholder, idx) => {
            textBefore = textBefore.replace(`__BLOCK_PLACEHOLDER_${idx}__`, placeholder)
          })
          if (textBefore) {
            // 检查是否包含 markdown 语法，如果不包含则使用 text 类型
            const contentType = hasMarkdownSyntax(textBefore) ? 'markdown' : 'text'
            result.push({ type: contentType, content: textBefore })
          }
        }

        // 添加行内公式，保留内容中的空格（trim 只去掉首尾空格）
        const formulaContent = inlineMatch[1].trim()
        result.push({ type: 'latex-inline', content: formulaContent })
        inlineLastIndex = inlineMatch.index + inlineMatch[0].length
      }

      // 添加剩余的文本
      if (inlineLastIndex < textWithPlaceholders.length) {
        let textAfter = textWithPlaceholders.substring(inlineLastIndex)
        // 恢复占位符
        blockPlaceholders.forEach((placeholder, idx) => {
          textAfter = textAfter.replace(`__BLOCK_PLACEHOLDER_${idx}__`, placeholder)
        })
        if (textAfter) {
          // 检查是否包含 markdown 语法，如果不包含则使用 text 类型
          const contentType = hasMarkdownSyntax(textAfter) ? 'markdown' : 'text'
          result.push({ type: contentType, content: textAfter })
        }
      }

      // 如果没有匹配到任何行内公式，检查是否包含 markdown 语法
      if (!hasInlineFormula) {
        const contentType = hasMarkdownSyntax(text) ? 'markdown' : 'text'
        result.push({ type: contentType, content: text })
      }
    }
  }

  // 如果没有匹配到任何公式，检查是否包含 markdown 语法
  if (result.length === 0) {
    const contentType = hasMarkdownSyntax(html) ? 'markdown' : 'text'
    result.push({ type: contentType, content: html })
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
    }
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      if (tagName === 'latex') {
        // LaTeX 标签转换为 $$...$$ 格式（块级）
        text += `$$${element.textContent || ''}$$`
      }
      else if (tagName === 'latex-inline') {
        // 行内公式标签转换为 $...$ 格式
        text += `$${element.textContent || ''}$`
      }
      else if (tagName === 'br') {
        text += '\n'
      }
      else if (tagName === 'p' || tagName === 'div') {
        // 段落和 div 标签，处理子节点
        for (let i = 0; i < element.childNodes.length; i++) {
          text += extractText(element.childNodes[i])
        }
      }
      else {
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
    return `<latex-inline>${content.trim()}</latex-inline>`
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
    }
    else {
      // 非空行，添加到当前段落
      if (currentParagraph) {
        currentParagraph += '<br>' + trimmedLine
      }
      else {
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

