import React from 'react'
import { useLocation, Redirect, useHistory } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@apollo/client'
import { useCurrentUser } from '@coko/client'

import { Login } from '../ui'
import { LOGIN, PUBLIC_ACCESS_CONTROLS } from '../graphql'

const getSafeRedirect = nextParam => {
  if (!nextParam) return '/dashboard'

  if (nextParam.startsWith('//')) return '/dashboard'

  try {
    const nextUrl = new URL(nextParam, window.location.origin)

    if (nextUrl.origin !== window.location.origin) return '/dashboard'

    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}` || '/dashboard'
  } catch (e) {
    if (nextParam.startsWith('/')) return nextParam
    return '/dashboard'
  }
}

const LoginPage = () => {
  const { search } = useLocation()
  const { setCurrentUser } = useCurrentUser()
  const history = useHistory()
  const { t } = useTranslation(null, { keyPrefix: 'pages.common' })

  const [loginMutation, { data, loading, error }] = useMutation(LOGIN)

  const { data: accessData } = useQuery(PUBLIC_ACCESS_CONTROLS)
  const signInEnabled = accessData?.publicAccessControls?.signInEnabled ?? true

  const redirectUrl = getSafeRedirect(new URLSearchParams(search).get('next'))

  const login = formData => {
    if (!signInEnabled) return
    const mutationData = {
      variables: {
        input: formData,
      },
    }

    loginMutation(mutationData).catch(e => console.error(e))
  }

  const existingToken = localStorage.getItem('token')
  if (existingToken) return <Redirect to={redirectUrl} />

  let errorMessage = t('notifications.error.messages.general')

  if (error?.message.includes('username or password'))
    errorMessage = t('form.password.errors.invalidCredentials')

  if (data) {
    const token = data.ketidaLogin?.token

    setCurrentUser(data.ketidaLogin?.user)

    if (token) {
      localStorage.setItem('token', token)
      return <Redirect to={redirectUrl} />
    }

    if (data.ketidaLogin?.code === 100) {
      history.push('/unverified-user/')
    }
  }

  const hasError = !!error || !signInEnabled

  return (
    <Login
      errorMessage={
        signInEnabled
          ? errorMessage
          : 'Sign-in is currently disabled. Please contact Datasphir.'
      }
      hasError={hasError}
      loading={loading}
      onSubmit={login}
    />
  )
}

export default LoginPage
