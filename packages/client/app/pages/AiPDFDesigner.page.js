import React, { useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useLazyQuery } from '@apollo/client'
import {
  GET_ENTIRE_BOOK,
  GET_BOOK_COMPONENT,
  GET_EXPORT_PROFILES,
} from '../graphql'
import AiPDFDesigner from '../ui/AiPDFDesigner/AiPDFDesigner'
import { CssAssistantContext } from '../ui/AiPDFDesigner/hooks/CssAssistantContext'

const AiPDFDesignerPage = () => {
  const params = useParams()
  const { setPassedContent } = useContext(CssAssistantContext)
  const { bookId } = params
  const [bookTitle, setBookTitle] = useState('')

  const { data: bookQueryData } = useQuery(GET_ENTIRE_BOOK, {
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'network-only',
    variables: {
      id: bookId,
    },
  })

  const [getDivision] = useLazyQuery(GET_BOOK_COMPONENT, {
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'network-only',
  })

  const { data: profilesData, refetch: refetchProfiles } = useQuery(
    GET_EXPORT_PROFILES,
    {
      fetchPolicy: 'network-only',
      variables: {
        bookId,
      },
    },
  )

  useEffect(() => {
    if (bookQueryData?.getBook?.divisions[1]) {
      setBookTitle(bookQueryData?.getBook.title)
      // templatesData && console.log(templatesData)

      const chaptersIds = bookQueryData.getBook.divisions[1].bookComponents.map(
        division => division.id,
      )

      setPassedContent('')
      Promise.all(
        chaptersIds.map((chapterId, i) =>
          getDivision({ variables: { id: chapterId } })
            .then(
              ({ data: chapter }) =>
                `<div class="chapter chapter-${i + 1}">${
                  chapter.getBookComponent.content
                }</div>`,
            )
            .catch(e => {
              throw new Error(e)
            }),
        ),
      ).then(chaptersContent => {
        setPassedContent(chaptersContent.join(''))
      })
    }
  }, [bookQueryData])

  return (
    <AiPDFDesigner
      bookId={bookId}
      bookTitle={bookTitle}
      profiles={profilesData?.getBookExportProfiles?.result || []}
      refetchProfiles={refetchProfiles}
    />
  )
}

export default AiPDFDesignerPage
