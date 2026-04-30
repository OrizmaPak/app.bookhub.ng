import React from 'react'
import { useMutation, useQuery } from '@apollo/client'

import { Signup } from '../ui'
import { SIGNUP, APPLICATION_PARAMETERS, PUBLIC_ACCESS_CONTROLS } from '../graphql'

const SignupPage = () => {
  const { data: { getApplicationParameters } = {} } = useQuery(
    APPLICATION_PARAMETERS,
    {
      variables: {
        context: 'bookBuilder',
        area: 'termsAndConditions',
      },
    },
  )

  const [signupMutation, { data, loading, error }] = useMutation(SIGNUP)

  const { data: accessData } = useQuery(PUBLIC_ACCESS_CONTROLS)
  const signUpEnabled = accessData?.publicAccessControls?.signUpEnabled ?? true

  const signup = formData => {
    if (!signUpEnabled) return
    const { agreedTc, email, givenNames, surname, password } = formData

    const mutationData = {
      variables: {
        input: {
          agreedTc,
          email,
          givenNames,
          surname,
          password,
        },
      },
    }

    signupMutation(mutationData).catch(e => console.error(e))
  }

  const termsAndConditions = getApplicationParameters?.find(
    p => p.area === 'termsAndConditions',
  )?.config

  return (
    <Signup
      errorMessage={
        signUpEnabled
          ? error?.message
          : 'Sign-up is currently disabled. Please contact Datasphir.'
      }
      hasError={!!error || !signUpEnabled}
      hasSuccess={!!data}
      loading={loading}
      onSubmit={signup}
      termsAndConditions={termsAndConditions}
    />
  )
}

export default SignupPage
