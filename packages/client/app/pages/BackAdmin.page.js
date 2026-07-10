import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { HistoryOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { useHistory, useLocation } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'

import {
  BACK_ADMIN_ACCESS,
  BACK_ADMIN_BOOK_TRANSFER_TRAIL,
  BACK_ADMIN_BOOK_TRANSFERS,
  BACK_ADMIN_BOOK_USER_STATS,
  BACK_ADMIN_EMAIL_QUEUE_STATS,
  BACK_ADMIN_INSTANCE_HEALTH,
  BACK_ADMIN_INSTANCE_LOGS,
  BACK_ADMIN_LOAD_SERIES,
  BACK_ADMIN_LOGOUT_ALL,
  BACK_ADMIN_LOGOUT_USER,
  BACK_ADMIN_REQUEST_OTP,
  BACK_ADMIN_REVOKE_BOOK_TRANSFER,
  BACK_ADMIN_SEND_EMAIL,
  BACK_ADMIN_SET_ACCESS,
  BACK_ADMIN_SET_USER_ACTIVE,
  BACK_ADMIN_STATS,
  BACK_ADMIN_USERS,
  BACK_ADMIN_VALIDATE,
  BACK_ADMIN_VERIFY_OTP,
} from '../graphql'
import ThothBrowserPanel from '../ui/backAdmin/ThothBrowserPanel'

const { TextArea } = Input

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1200px;
  padding: 24px;
`

const AccessCard = styled(Card)`
  margin: 60px auto;
  max-width: 520px;
`

const StatSvg = ({ points }) => {
  if (!points || points.length < 2) {
    return <Typography.Text type="secondary">Not enough data points yet.</Typography.Text>
  }

  const width = 640
  const height = 180
  const padding = 10
  const values = points.map(p => Number(p.load1 || 0))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const polyline = values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (values.length - 1)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg height="180" role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
      <rect fill="transparent" height={height} width={width} x="0" y="0" />
      <polyline
        fill="none"
        points={polyline}
        stroke="#1677ff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

StatSvg.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      load1: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  ),
}

StatSvg.defaultProps = {
  points: [],
}

const BackAdminPage = () => {
  const history = useHistory()
  const location = useLocation()
  const allowedPanels = ['home', 'manage', 'health', 'thoth', 'books']

  const getPanelFromSearch = search => {
    const panelValue = new URLSearchParams(search).get('panel')
    return allowedPanels.includes(panelValue) ? panelValue : 'home'
  }

  const [emailInput, setEmailInput] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [otpRequestedFor, setOtpRequestedFor] = useState('')

  const [sessionToken, setSessionToken] = useState(
    () => sessionStorage.getItem('backAdminSessionToken') || '',
  )

  const [panel, setPanel] = useState(() => getPanelFromSearch(location.search))
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [emailAudience, setEmailAudience] = useState('selected')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [selectedHealthService, setSelectedHealthService] = useState('bookhub-runtime')
  const [bookTransferStatus, setBookTransferStatus] = useState('all')
  const [bookTransferSearch, setBookTransferSearch] = useState('')
  const [trailBookId, setTrailBookId] = useState(null)
  const [trailRevokeTargetId, setTrailRevokeTargetId] = useState(null)
  const [trailRevokeReason, setTrailRevokeReason] = useState('')

  const monitoringUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/monitoring/`
      : '/monitoring/'

  const [accessState, setAccessState] = useState({
    signInEnabled: true,
    signUpEnabled: true,
  })

  const selectedLoadService =
    selectedHealthService === 'all' ? 'bookhub-runtime' : selectedHealthService

  const isUnlocked = Boolean(sessionToken)

  useEffect(() => {
    const nextPanel = getPanelFromSearch(location.search)

    if (nextPanel !== panel) {
      setPanel(nextPanel)
    }
  }, [location.search, panel])

  const navigatePanel = value => {
    const nextPanel = allowedPanels.includes(value) ? value : 'home'
    setPanel(nextPanel)
    const params = new URLSearchParams(location.search)

    if (nextPanel === 'home') {
      params.delete('panel')
    } else {
      params.set('panel', nextPanel)
    }

    history.replace({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : '',
    })
  }

  const [requestOtp, { loading: requestOtpLoading }] = useMutation(BACK_ADMIN_REQUEST_OTP)
  const [verifyOtp, { loading: verifyOtpLoading }] = useMutation(BACK_ADMIN_VERIFY_OTP)

  const {
    data: validateData,
    loading: validateLoading,
  } = useQuery(BACK_ADMIN_VALIDATE, {
    variables: { sessionToken },
    skip: !isUnlocked,
    fetchPolicy: 'network-only',
    onError: () => {
      sessionStorage.removeItem('backAdminSessionToken')
      setSessionToken('')
    },
  })

  const canLoadData = isUnlocked && validateData?.backAdminValidate
  const canLoadManage = canLoadData && panel === 'manage'
  const canLoadHealth = canLoadData && panel === 'health'
  const canLoadBooks = canLoadData && panel === 'books'

  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useQuery(
    BACK_ADMIN_STATS,
    {
      variables: { sessionToken },
      skip: !canLoadManage,
      fetchPolicy: 'network-only',
    },
  )

  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery(
    BACK_ADMIN_USERS,
    {
      variables: { sessionToken },
      skip: !canLoadManage,
      fetchPolicy: 'network-only',
    },
  )

  const {
    data: bookUserStatsData,
    loading: bookUserStatsLoading,
    refetch: refetchBookUserStats,
  } = useQuery(BACK_ADMIN_BOOK_USER_STATS, {
    variables: { sessionToken },
    skip: !canLoadBooks,
    fetchPolicy: 'network-only',
  })

  const {
    data: bookTransfersData,
    loading: bookTransfersLoading,
    refetch: refetchBookTransfers,
  } = useQuery(BACK_ADMIN_BOOK_TRANSFERS, {
    variables: {
      sessionToken,
      status: bookTransferStatus,
      search: bookTransferSearch,
    },
    skip: !canLoadBooks,
    fetchPolicy: 'network-only',
  })

  const {
    data: transferTrailData,
    loading: transferTrailLoading,
    refetch: refetchTransferTrail,
  } = useQuery(BACK_ADMIN_BOOK_TRANSFER_TRAIL, {
    variables: {
      sessionToken,
      bookId: trailBookId,
    },
    skip: !canLoadBooks || !trailBookId,
    fetchPolicy: 'network-only',
  })

  const { data: accessData, loading: accessLoading, refetch: refetchAccess } = useQuery(
    BACK_ADMIN_ACCESS,
    {
      variables: { sessionToken },
      skip: !canLoadManage,
      fetchPolicy: 'network-only',
    },
  )

  useEffect(() => {
    if (accessData?.backAdminAccess) {
      setAccessState({
        signInEnabled: !!accessData.backAdminAccess.signInEnabled,
        signUpEnabled: !!accessData.backAdminAccess.signUpEnabled,
      })
    }
  }, [
    accessData?.backAdminAccess?.signInEnabled,
    accessData?.backAdminAccess?.signUpEnabled,
  ])

  const {
    data: emailQueueData,
    loading: emailQueueLoading,
    refetch: refetchEmailQueue,
  } = useQuery(BACK_ADMIN_EMAIL_QUEUE_STATS, {
    variables: { sessionToken },
    skip: !canLoadManage,
    fetchPolicy: 'network-only',
  })

  const {
    data: healthData,
    loading: healthLoading,
    refetch: refetchHealth,
  } = useQuery(BACK_ADMIN_INSTANCE_HEALTH, {
    variables: { sessionToken },
    skip: !canLoadHealth,
    fetchPolicy: 'network-only',
  })

  const {
    data: loadSeriesData,
    loading: loadSeriesLoading,
    refetch: refetchLoadSeries,
  } = useQuery(BACK_ADMIN_LOAD_SERIES, {
    variables: { sessionToken, service: selectedLoadService, minutes: 180 },
    skip: !canLoadHealth,
    fetchPolicy: 'network-only',
  })

  const { data: logsData, loading: logsLoading, refetch: refetchLogs } = useQuery(
    BACK_ADMIN_INSTANCE_LOGS,
    {
      variables: {
        sessionToken,
        service: selectedHealthService === 'all' ? null : selectedHealthService,
        limit: 100,
      },
      skip: !canLoadHealth,
      fetchPolicy: 'network-only',
    },
  )

  const [setUserActive, { loading: setUserActiveLoading }] = useMutation(
    BACK_ADMIN_SET_USER_ACTIVE,
  )

  const [logoutUser, { loading: logoutUserLoading }] = useMutation(BACK_ADMIN_LOGOUT_USER)
  const [logoutAllUsers, { loading: logoutAllLoading }] = useMutation(BACK_ADMIN_LOGOUT_ALL)
  const [sendEmail, { loading: sendEmailLoading }] = useMutation(BACK_ADMIN_SEND_EMAIL)
  const [setAccess, { loading: setAccessLoading }] = useMutation(BACK_ADMIN_SET_ACCESS)

  const [revokeBookTransfer, { loading: revokeBookTransferLoading }] = useMutation(
    BACK_ADMIN_REVOKE_BOOK_TRANSFER,
  )

  const totalLoading =
    validateLoading ||
    statsLoading ||
    usersLoading ||
    accessLoading ||
    emailQueueLoading ||
    setUserActiveLoading ||
    logoutUserLoading ||
    logoutAllLoading ||
    sendEmailLoading ||
    setAccessLoading ||
    bookUserStatsLoading ||
    bookTransfersLoading ||
    transferTrailLoading ||
    revokeBookTransferLoading

  const transferTrail = transferTrailData?.backAdminBookTransferTrail || null
  const trailRevokeTargets = transferTrail?.revokeTargets || []

  const activeTrailTransfer =
    transferTrail?.entries?.find(entry => entry.status === 'active') || null

  useEffect(() => {
    if (trailRevokeTargets.length === 1) {
      setTrailRevokeTargetId(trailRevokeTargets[0].userId)
      return
    }

    if (
      trailRevokeTargetId &&
      !trailRevokeTargets.some(target => target.userId === trailRevokeTargetId)
    ) {
      setTrailRevokeTargetId(null)
    }
  }, [trailRevokeTargetId, trailRevokeTargets])

  const handleRequestOtp = async () => {
    try {
      const normalized = emailInput.trim().toLowerCase()
      const { data } = await requestOtp({ variables: { email: normalized } })
      const result = data?.backAdminRequestOtp

      if (!result?.ok) {
        message.error(result?.message || 'OTP request failed')
        return
      }

      setOtpRequestedFor(normalized)
      message.success(result.message || 'OTP sent')
    } catch (error) {
      message.error(error.message || 'OTP request failed')
    }
  }

  const handleVerifyOtp = async () => {
    try {
      const { data } = await verifyOtp({
        variables: { email: otpRequestedFor, otp: otpInput.trim() },
      })

      const token = data?.backAdminVerifyOtp?.token
      if (!token) throw new Error('No session token returned')
      sessionStorage.setItem('backAdminSessionToken', token)
      setSessionToken(token)
      setPanel('home')
      message.success('Back-admin access granted')
    } catch (error) {
      message.error(error.message || 'OTP verification failed')
    }
  }

  const handleSetUserActive = async (userId, isActive) => {
    try {
      await setUserActive({
        variables: {
          sessionToken,
          userId,
          isActive,
        },
      })
      await refetchUsers()
      await refetchStats()
      message.success(`User ${isActive ? 'allowed' : 'blocked'}`)
    } catch (error) {
      message.error(error.message || 'Could not update user access')
    }
  }

  const handleLogoutUser = async userId => {
    try {
      await logoutUser({ variables: { sessionToken, userId } })
      await refetchUsers()
      await refetchStats()
      message.success('User sessions revoked')
    } catch (error) {
      message.error(error.message || 'Could not log out user')
    }
  }

  const handleLogoutAllUsers = async () => {
    Modal.confirm({
      title: 'Force logout all non-admin users?',
      content: 'This will invalidate sessions for all active non-admin users.',
      okText: 'Force logout all',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          const { data } = await logoutAllUsers({
            variables: { sessionToken, includeAdmins: false },
          })

          await refetchUsers()
          await refetchStats()
          message.success(`Logged out ${data?.backAdminLogoutAll || 0} users`)
        } catch (error) {
          message.error(error.message || 'Could not log out all users')
        }
      },
    })
  }

  const handleSetAccess = async (patch = {}) => {
    const currentAccess = accessState
    const next = { ...currentAccess, ...patch }
    setAccessState(next)

    try {
      const { data } = await setAccess({
        variables: {
          sessionToken,
          signInEnabled: next.signInEnabled,
          signUpEnabled: next.signUpEnabled,
        },
      })

      const updated = data?.backAdminSetAccess || next
      setAccessState(updated)
      await Promise.all([refetchAccess(), refetchStats()])
      message.success('Access controls updated')
    } catch (error) {
      setAccessState(currentAccess)
      message.error(error.message || 'Could not update access controls')
    }
  }

  const handleRevokeBookTransfer = row => {
    let reason = ''

    Modal.confirm({
      title: 'Revoke this ownership transfer?',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            description="The current owner will lose owner access unless the previous owner shares the book back."
            message="This will move ownership back to the previous owner."
            showIcon
            type="warning"
          />
          <Typography.Text strong>{row.bookTitle}</Typography.Text>
          <Input
            onChange={event => {
              reason = event.target.value
            }}
            placeholder="Optional reason"
          />
        </Space>
      ),
      okText: 'Revoke transfer',
      okButtonProps: { danger: true, loading: revokeBookTransferLoading },
      async onOk() {
        try {
          await revokeBookTransfer({
            variables: {
              sessionToken,
              transferId: row.id,
              reason: reason.trim() || null,
            },
          })
          await Promise.all([refetchBookTransfers(), refetchBookUserStats()])
          message.success('Ownership transfer revoked')
        } catch (error) {
          message.error(error.message || 'Could not revoke ownership transfer')
        }
      },
    })
  }

  const openTransferTrail = row => {
    setTrailBookId(row.bookId)
    setTrailRevokeTargetId(null)
    setTrailRevokeReason('')
  }

  const closeTransferTrail = () => {
    setTrailBookId(null)
    setTrailRevokeTargetId(null)
    setTrailRevokeReason('')
  }

  const handleRevokeFromTrail = async () => {
    if (!activeTrailTransfer) {
      message.error('There is no active transfer to revoke for this book.')
      return
    }

    if (!trailRevokeTargetId) {
      message.error('Select who ownership should be restored to.')
      return
    }

    try {
      await revokeBookTransfer({
        variables: {
          sessionToken,
          transferId: activeTrailTransfer.id,
          targetUserId: trailRevokeTargetId,
          reason: trailRevokeReason.trim() || null,
        },
      })

      await Promise.all([
        refetchBookTransfers(),
        refetchBookUserStats(),
        refetchTransferTrail(),
      ])

      message.success('Ownership restored to selected trail owner')
      closeTransferTrail()
    } catch (error) {
      message.error(error.message || 'Could not revoke ownership transfer')
    }
  }

  const handleSendEmail = async () => {
    if (!canSendEmail) return

    try {
      const { data } = await sendEmail({
        variables: {
          sessionToken,
          subject: emailSubject.trim(),
          message: emailBody.trim(),
          userIds:
            emailAudience === 'all' ? [] : selectedUsersWithEmail.map(user => user.id),
          sendToAll: emailAudience === 'all',
        },
      })

      const { sent, failed } = data?.backAdminSendEmail || { sent: 0, failed: 0 }
      message.success(`Email queued: ${sent}, failed: ${failed}`)
      setEmailSubject('')
      setEmailBody('')
      await refetchEmailQueue()
    } catch (error) {
      message.error(error.message || 'Could not send email')
    }
  }

  const users = usersData?.backAdminUsers || []
  const selectedUsers = users.filter(user => selectedUserIds.includes(user.id))
  const selectedUsersWithEmail = selectedUsers.filter(user => user.email)
  const allUsersWithEmail = users.filter(user => user.email)

  const recipientCount =
    emailAudience === 'all' ? allUsersWithEmail.length : selectedUsersWithEmail.length

  const canSendEmail = emailSubject.trim() && emailBody.trim() && recipientCount > 0

  const stats = statsData?.backAdminStats || {
    totalUsers: 0,
    activeUsers: 0,
    totalBooks: 0,
  }

  const access = accessState
  const emailQueueStats = emailQueueData?.backAdminEmailQueueStats || {}
  const serviceHealth = healthData?.backAdminInstanceHealth || []

  const serviceOptions = [
    { label: 'All services', value: 'all' },
    ...serviceHealth.map(item => ({ label: item.service, value: item.service })),
  ]

  const loadSeries = loadSeriesData?.backAdminLoadSeries || []
  const logs = logsData?.backAdminInstanceLogs || []
  const bookUserStats = bookUserStatsData?.backAdminBookUserStats || []
  const bookTransfers = bookTransfersData?.backAdminBookTransfers || []

  const bookGovernanceTotals = bookUserStats.reduce(
    (totals, row) => ({
      usersWithBooks: totals.usersWithBooks + (row.totalBooks > 0 ? 1 : 0),
      ownedBooks: totals.ownedBooks + row.ownedBooks,
      webPublishedBooks: totals.webPublishedBooks + row.webPublishedBooks,
      metadataAverage:
        totals.metadataAverage + (row.totalBooks > 0 ? row.metadataAveragePercent : 0),
      usersInAverage: totals.usersInAverage + (row.totalBooks > 0 ? 1 : 0),
    }),
    {
      usersWithBooks: 0,
      ownedBooks: 0,
      webPublishedBooks: 0,
      metadataAverage: 0,
      usersInAverage: 0,
    },
  )

  const activeTransferCount = bookTransfers.filter(row => row.status === 'active').length

  const metadataAverage = bookGovernanceTotals.usersInAverage
    ? Math.round(
        bookGovernanceTotals.metadataAverage / bookGovernanceTotals.usersInAverage,
      )
    : 0

  const userColumns = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'displayName',
        key: 'displayName',
        render: (_, row) => row.displayName || row.username || '(No name)',
      },
      { title: 'Email', dataIndex: 'email', key: 'email' },
      {
        title: 'Status',
        dataIndex: 'isActive',
        key: 'isActive',
        render: value => (value ? 'Allowed' : 'Blocked'),
      },
      {
        title: 'Action',
        key: 'action',
        render: (_, row) => {
          if (!row.isActive) {
            return (
              <Button
                disabled={setUserActiveLoading}
                onClick={() => handleSetUserActive(row.id, true)}
                size="small"
                type="primary"
              >
                Allow user
              </Button>
            )
          }

          return (
            <Space>
              <Button
                danger
                disabled={logoutUserLoading}
                onClick={() => handleLogoutUser(row.id)}
                size="small"
              >
                Logout user
              </Button>
              <Button
                disabled={setUserActiveLoading}
                onClick={() => handleSetUserActive(row.id, false)}
                size="small"
              >
                Block user
              </Button>
            </Space>
          )
        },
      },
    ],
    [logoutUserLoading, setUserActiveLoading],
  )

  const bookUserColumns = [
    {
      title: 'User',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (_, row) => row.displayName || row.email || '(No name)',
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Access',
      dataIndex: 'isActive',
      key: 'isActive',
      render: value =>
        value ? <Tag color="green">Active</Tag> : <Tag color="red">Blocked</Tag>,
    },
    { title: 'Owned', dataIndex: 'ownedBooks', key: 'ownedBooks' },
    {
      title: 'Collaborator',
      dataIndex: 'collaboratorBooks',
      key: 'collaboratorBooks',
    },
    { title: 'Total', dataIndex: 'totalBooks', key: 'totalBooks' },
    {
      title: 'Web published',
      dataIndex: 'webPublishedBooks',
      key: 'webPublishedBooks',
    },
    {
      title: 'Metadata progress',
      dataIndex: 'metadataAveragePercent',
      key: 'metadataAveragePercent',
      render: value => <Tag color={value >= 70 ? 'green' : 'orange'}>{value}%</Tag>,
    },
  ]

  const transferColumns = [
    { title: 'Book', dataIndex: 'bookTitle', key: 'bookTitle' },
    {
      title: 'From',
      key: 'from',
      render: (_, row) => row.fromUserName || row.fromUserEmail || row.fromUserId,
    },
    {
      title: 'To',
      key: 'to',
      render: (_, row) => row.toUserName || row.toUserEmail || row.toUserId,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: value => (
        <Tag color={value === 'active' ? 'blue' : 'default'}>
          {`${value || ''}`.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Transferred',
      dataIndex: 'created',
      key: 'created',
      render: value => (value ? new Date(value).toLocaleString() : ''),
    },
    {
      title: 'Revoked',
      dataIndex: 'revokedAt',
      key: 'revokedAt',
      render: value => (value ? new Date(value).toLocaleString() : ''),
    },
    {
      title: 'Trail',
      key: 'trail',
      render: (_, row) => (
        <Button
          icon={<HistoryOutlined />}
          onClick={() => openTransferTrail(row)}
          shape="circle"
          size="small"
          title="View transfer trail"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, row) =>
        row.status === 'active' ? (
          <Button
            danger
            loading={revokeBookTransferLoading}
            onClick={() => handleRevokeBookTransfer(row)}
            size="small"
          >
            Revoke
          </Button>
        ) : (
          <Typography.Text type="secondary">No action</Typography.Text>
        ),
    },
  ]

  const trailEntryColumns = [
    {
      title: 'Time',
      dataIndex: 'created',
      key: 'created',
      render: value => (value ? new Date(value).toLocaleString() : ''),
    },
    {
      title: 'Owner before',
      key: 'from',
      render: (_, row) => row.fromUserName || row.fromUserEmail || row.fromUserId,
    },
    {
      title: 'Owner after',
      key: 'to',
      render: (_, row) => row.toUserName || row.toUserEmail || row.toUserId,
    },
    {
      title: 'Transferred by',
      key: 'by',
      render: (_, row) =>
        row.transferredByName || row.transferredByEmail || row.transferredByUserId,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: value => (
        <Tag color={value === 'active' ? 'blue' : 'default'}>
          {`${value || ''}`.toUpperCase()}
        </Tag>
      ),
    },
  ]

  const healthColumns = [
    { title: 'Service', dataIndex: 'service', key: 'service' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_, row) =>
        row.isHealthy ? <Tag color="green">Healthy</Tag> : <Tag color="red">Unhealthy</Tag>,
    },
    { title: 'Latency (ms)', dataIndex: 'latencyMs', key: 'latencyMs' },
    { title: 'HTTP', dataIndex: 'statusCode', key: 'statusCode' },
    {
      title: 'Checked At',
      dataIndex: 'checkedAt',
      key: 'checkedAt',
      render: value => new Date(value).toLocaleString(),
    },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ]

  const logColumns = [
    {
      title: 'Time',
      dataIndex: 'checkedAt',
      key: 'checkedAt',
      render: value => new Date(value).toLocaleString(),
    },
    { title: 'Service', dataIndex: 'service', key: 'service' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Latency', dataIndex: 'latencyMs', key: 'latencyMs' },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ]

  if (!isUnlocked) {
    const showOtpEntry = Boolean(otpRequestedFor)
    return (
      <Wrapper>
        <AccessCard title="Back Office Access">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {!showOtpEntry ? (
              <>
                <Typography.Text>
                  Enter your Datasphir email to receive an OTP.
                </Typography.Text>
                <Input
                  onChange={e => setEmailInput(e.target.value)}
                  onPressEnter={handleRequestOtp}
                  placeholder="you@datasphir.com"
                  value={emailInput}
                />
                <Button
                  loading={requestOtpLoading}
                  onClick={handleRequestOtp}
                  type="primary"
                >
                  Request OTP
                </Button>
              </>
            ) : (
              <>
                <Alert
                  description="Enter the one-time code to continue."
                  message={`OTP sent to ${otpRequestedFor}`}
                  showIcon
                  type="info"
                />
                <Input
                  onChange={e => setOtpInput(e.target.value)}
                  onPressEnter={handleVerifyOtp}
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                />
                <Space>
                  <Button
                    loading={verifyOtpLoading}
                    onClick={handleVerifyOtp}
                    type="primary"
                  >
                    Verify OTP
                  </Button>
                  <Button
                    onClick={() => {
                      setOtpRequestedFor('')
                      setOtpInput('')
                    }}
                  >
                    Back
                  </Button>
                </Space>
              </>
            )}
          </Space>
        </AccessCard>
      </Wrapper>
    )
  }

  if (!canLoadData) {
    return (
      <Wrapper>
        <Alert
          description="Refresh and request a new OTP."
          message="Back-admin session expired"
          showIcon
          type="warning"
        />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              Back Office
            </Typography.Title>
          </Col>
          <Col>
            <Button
              onClick={() => {
                sessionStorage.removeItem('backAdminSessionToken')
                setSessionToken('')
                navigatePanel('home')
              }}
            >
              Log out
            </Button>
          </Col>
        </Row>

        <Segmented
          onChange={value => navigatePanel(value)}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'manage', label: 'Manage Instance Activity' },
            { value: 'health', label: 'Instance Health Check and Logs' },
            { value: 'thoth', label: 'Thoth Metadata Browser' },
            { value: 'books', label: 'Book Governance' },
          ]}
          value={panel}
        />

        {panel === 'home' && (
          <Row gutter={[16, 16]}>
            <Col md={12} xs={24}>
              <Card title="Manage Instance Activity">
                <Typography.Paragraph>
                  Control sign-in/sign-up, manage users, force logout, and queue emails.
                </Typography.Paragraph>
                <Button onClick={() => navigatePanel('manage')} type="primary">
                  Open Manage Instance Activity
                </Button>
              </Card>
            </Col>
            <Col md={12} xs={24}>
              <Card title="Instance Health Check and Logs">
                <Typography.Paragraph>
                  View service health, load trends, and instance monitoring logs.
                </Typography.Paragraph>
                <Button onClick={() => navigatePanel('health')}>
                  Open Instance Health Check and Logs
                </Button>
              </Card>
            </Col>
            <Col md={12} xs={24}>
              <Card title="Thoth Metadata Browser">
                <Typography.Paragraph>
                  Browse Thoth test/live metadata records without writing GraphQL.
                </Typography.Paragraph>
                <Button onClick={() => navigatePanel('thoth')}>
                  Open Thoth Metadata Browser
                </Button>
              </Card>
            </Col>
            <Col md={12} xs={24}>
              <Card title="Book Governance">
                <Typography.Paragraph>
                  Track user book ownership, web publishing, metadata progress, and
                  ownership transfers.
                </Typography.Paragraph>
                <Button onClick={() => navigatePanel('books')}>
                  Open Book Governance
                </Button>
              </Card>
            </Col>
            <Col xs={24}>
              <Card
                extra={
                  <Button onClick={() => window.open(monitoringUrl, '_blank')} type="primary">
                    Open Grafana
                  </Button>
                }
                title="Grafana Monitoring Dashboard"
              >
                <Typography.Paragraph>
                  Live infrastructure metrics are available at <strong>/monitoring/</strong>.
                  Use this to inspect host, container, and uptime signals.
                </Typography.Paragraph>
              </Card>
            </Col>
          </Row>
        )}

        {panel === 'manage' && (
          <>
            <Row gutter={[16, 16]}>
              <Col md={8} xs={24}>
                <Card>
                  <Statistic title="Total Users" value={stats.totalUsers} />
                </Card>
              </Col>
              <Col md={8} xs={24}>
                <Card>
                  <Statistic title="Active Users" value={stats.activeUsers} />
                </Card>
              </Col>
              <Col md={8} xs={24}>
                <Card>
                  <Statistic title="Total Books" value={stats.totalBooks} />
                </Card>
              </Col>
            </Row>

            <Card
              extra={<Button onClick={() => refetchEmailQueue()} size="small">Refresh</Button>}
              title="Email Queue"
            >
              <Row gutter={[16, 16]}>
                <Col md={4} xs={12}>
                  <Statistic title="Pending" value={emailQueueStats.pending || 0} />
                </Col>
                <Col md={4} xs={12}>
                  <Statistic title="Processing" value={emailQueueStats.processing || 0} />
                </Col>
                <Col md={4} xs={12}>
                  <Statistic title="Sent" value={emailQueueStats.sent || 0} />
                </Col>
                <Col md={4} xs={12}>
                  <Statistic title="Failed" value={emailQueueStats.failed || 0} />
                </Col>
                <Col md={4} xs={12}>
                  <Statistic title="Total" value={emailQueueStats.total || 0} />
                </Col>
              </Row>
            </Card>

            <Card title="Global Access Controls">
              <Space direction="vertical" size="middle">
                <Space>
                  <Typography.Text>Allow sign-in</Typography.Text>
                  <Switch
                    checked={access.signInEnabled}
                    disabled={setAccessLoading}
                    onChange={checked => handleSetAccess({ signInEnabled: checked })}
                  />
                </Space>
                <Space>
                  <Typography.Text>Allow sign-up</Typography.Text>
                  <Switch
                    checked={access.signUpEnabled}
                    disabled={setAccessLoading}
                    onChange={checked => handleSetAccess({ signUpEnabled: checked })}
                  />
                </Space>
              </Space>
            </Card>

            <Card
              extra={
                <Button danger loading={logoutAllLoading} onClick={handleLogoutAllUsers}>
                  Logout all users
                </Button>
              }
              title="Session Controls"
            >
              <Typography.Text>
                Force logout invalidates active sessions. Users can sign in again immediately.
              </Typography.Text>
            </Card>

            <Card title="Email Users">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Radio.Group
                  onChange={e => setEmailAudience(e.target.value)}
                  value={emailAudience}
                >
                  <Space direction="vertical">
                    <Radio value="selected">
                      Selected users ({selectedUsersWithEmail.length})
                    </Radio>
                    <Radio value="all">All users ({allUsersWithEmail.length})</Radio>
                  </Space>
                </Radio.Group>

                <Input
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Email subject"
                  value={emailSubject}
                />
                <TextArea
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Write your message"
                  rows={6}
                  value={emailBody}
                />

                <Space>
                  <Button
                    disabled={!canSendEmail}
                    loading={sendEmailLoading}
                    onClick={handleSendEmail}
                    type="primary"
                  >
                    Send email
                  </Button>
                  <Typography.Text type="secondary">
                    Recipients: {recipientCount}
                  </Typography.Text>
                </Space>
              </Space>
            </Card>

            <Card title="Users">
              <Table
                columns={userColumns}
                dataSource={users}
                loading={totalLoading}
                pagination={{ pageSize: 20 }}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedUserIds,
                  onChange: keys => setSelectedUserIds(keys),
                }}
              />
            </Card>
          </>
        )}

        {panel === 'health' && (
          <>
            <Card
              extra={
                <Button
                  onClick={() => {
                    refetchHealth()
                    refetchLoadSeries()
                    refetchLogs()
                  }}
                >
                  Refresh
                </Button>
              }
              title="Service Health"
            >
              <Table
                columns={healthColumns}
                dataSource={serviceHealth}
                loading={healthLoading}
                pagination={false}
                rowKey="service"
              />
            </Card>

            <Card title="Instance Load (last 3h)">
              <Space style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">Service:</Typography.Text>
                <Select
                  onChange={value => setSelectedHealthService(value)}
                  options={serviceOptions}
                  style={{ minWidth: 240 }}
                  value={selectedHealthService}
                />
              </Space>
              <StatSvg points={loadSeries} />
              <Typography.Text type="secondary">
                Source: persisted instance metric snapshots.
              </Typography.Text>
              {(loadSeriesLoading || healthLoading) && (
                <div>
                  <Typography.Text type="secondary">Loading latest points...</Typography.Text>
                </div>
              )}
            </Card>

            <Card title="Instance Logs">
              <Table
                columns={logColumns}
                dataSource={logs}
                loading={logsLoading}
                pagination={{ pageSize: 20 }}
                rowKey="id"
              />
            </Card>

            <Card
              extra={
                <Button onClick={() => window.open(monitoringUrl, '_blank')}>
                  Open in new tab
                </Button>
              }
              title="Grafana (Embedded)"
            >
              <iframe
                src={monitoringUrl}
                style={{
                  width: '100%',
                  height: 720,
                  border: 0,
                  borderRadius: 8,
                  background: '#fff',
                }}
                title="Bookhub monitoring dashboard"
              />
            </Card>
          </>
        )}

        {panel === 'books' && (
          <>
            <Row gutter={[16, 16]}>
              <Col md={6} xs={24}>
                <Card>
                  <Statistic
                    title="Users with books"
                    value={bookGovernanceTotals.usersWithBooks}
                  />
                </Card>
              </Col>
              <Col md={6} xs={24}>
                <Card>
                  <Statistic title="Owned books" value={bookGovernanceTotals.ownedBooks} />
                </Card>
              </Col>
              <Col md={6} xs={24}>
                <Card>
                  <Statistic
                    title="Web published"
                    value={bookGovernanceTotals.webPublishedBooks}
                  />
                </Card>
              </Col>
              <Col md={6} xs={24}>
                <Card>
                  <Statistic suffix="%" title="Avg metadata" value={metadataAverage} />
                </Card>
              </Col>
            </Row>

            <Card
              extra={
                <Button onClick={() => refetchBookUserStats()}>
                  Refresh
                </Button>
              }
              title="User Book Activity"
            >
              <Table
                columns={bookUserColumns}
                dataSource={bookUserStats}
                loading={bookUserStatsLoading}
                pagination={{ pageSize: 20 }}
                rowKey="userId"
              />
            </Card>

            <Card
              extra={
                <Space>
                  <Tag color={activeTransferCount ? 'blue' : 'default'}>
                    Active: {activeTransferCount}
                  </Tag>
                  <Button onClick={() => refetchBookTransfers()}>
                    Refresh
                  </Button>
                </Space>
              }
              title="Ownership Transfers"
            >
              <Space
                direction="vertical"
                size="middle"
                style={{ width: '100%', marginBottom: 16 }}
              >
                <Alert
                  description="Revoke is only available while the transfer is still the current active ownership path. If the book has already moved again, revocation is blocked server-side."
                  message="Ownership transfer audit"
                  showIcon
                  type="info"
                />
                <Space wrap>
                  <Select
                    onChange={value => setBookTransferStatus(value)}
                    options={[
                      { value: 'all', label: 'All transfers' },
                      { value: 'active', label: 'Active' },
                      { value: 'revoked', label: 'Revoked' },
                      { value: 'superseded', label: 'Superseded' },
                    ]}
                    style={{ width: 180 }}
                    value={bookTransferStatus}
                  />
                  <Input.Search
                    allowClear
                    onChange={event => setBookTransferSearch(event.target.value)}
                    onSearch={() => refetchBookTransfers()}
                    placeholder="Search book or user"
                    style={{ width: 280 }}
                    value={bookTransferSearch}
                  />
                </Space>
              </Space>

              <Table
                columns={transferColumns}
                dataSource={bookTransfers}
                loading={bookTransfersLoading}
                pagination={{ pageSize: 20 }}
                rowKey="id"
              />
            </Card>
          </>
        )}

        <Modal
          footer={[
            <Button key="close" onClick={closeTransferTrail}>
              Close
            </Button>,
            activeTrailTransfer ? (
              <Button
                danger
                disabled={!trailRevokeTargetId}
                key="revoke"
                loading={revokeBookTransferLoading}
                onClick={handleRevokeFromTrail}
                type="primary"
              >
                Revoke to selected owner
              </Button>
            ) : null,
          ].filter(Boolean)}
          onCancel={closeTransferTrail}
          open={Boolean(trailBookId)}
          title={`Transfer trail${transferTrail?.bookTitle ? ` - ${transferTrail.bookTitle}` : ''}`}
          width={960}
        >
          {transferTrailLoading && (
            <Typography.Text type="secondary">Loading transfer trail...</Typography.Text>
          )}

          {!transferTrailLoading && transferTrail && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                description="This shows the ownership chain for this book. If the book has moved across many people, every recorded owner in the chain is shown here."
                message="Ownership trail"
                showIcon
                type="info"
              />

              <Card size="small">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Typography.Text strong>Current owner</Typography.Text>
                  <Typography.Text>
                    {transferTrail.currentOwnerName ||
                      transferTrail.currentOwnerEmail ||
                      transferTrail.currentOwnerUserId ||
                      'Unknown'}
                  </Typography.Text>
                </Space>
              </Card>

              <Card size="small" title={`Owner path (${transferTrail.ownerPath.length})`}>
                <Space wrap>
                  {transferTrail.ownerPath.map((owner, index) => (
                    <React.Fragment key={owner.pathKey}>
                      <Tag color={index === transferTrail.ownerPath.length - 1 ? 'blue' : 'default'}>
                        {owner.name || owner.email || owner.userId}
                      </Tag>
                      {index < transferTrail.ownerPath.length - 1 && (
                        <Typography.Text type="secondary">-&gt;</Typography.Text>
                      )}
                    </React.Fragment>
                  ))}
                </Space>
              </Card>

              {activeTrailTransfer ? (
                <Card size="small" title="Revoke destination">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {trailRevokeTargets.length === 1 ? (
                      <Alert
                        message={`This will revoke ownership back to ${
                          trailRevokeTargets[0].name ||
                          trailRevokeTargets[0].email ||
                          trailRevokeTargets[0].userId
                        }.`}
                        showIcon
                        type="warning"
                      />
                    ) : (
                      <>
                        <Typography.Text>
                          Select the previous owner that should receive ownership again.
                        </Typography.Text>
                        <Select
                          onChange={value => setTrailRevokeTargetId(value)}
                          options={trailRevokeTargets.map(target => ({
                            value: target.userId,
                            label: target.name || target.email || target.userId,
                          }))}
                          placeholder="Select owner from trail"
                          style={{ width: '100%' }}
                          value={trailRevokeTargetId}
                        />
                      </>
                    )}
                    <Input
                      onChange={event => setTrailRevokeReason(event.target.value)}
                      placeholder="Optional revoke reason"
                      value={trailRevokeReason}
                    />
                  </Space>
                </Card>
              ) : (
                <Alert
                  description="This trail is historical only, or the latest active transfer has already been revoked."
                  message="No active transfer to revoke"
                  showIcon
                  type="success"
                />
              )}

              <Table
                columns={trailEntryColumns}
                dataSource={transferTrail.entries}
                pagination={{ pageSize: 7 }}
                rowKey="id"
                size="small"
              />
            </Space>
          )}

          {!transferTrailLoading && !transferTrail && (
            <Typography.Text type="secondary">No transfer trail found.</Typography.Text>
          )}
        </Modal>

        {panel === 'thoth' && <ThothBrowserPanel sessionToken={sessionToken} />}
      </Space>
    </Wrapper>
  )
}

export default BackAdminPage
