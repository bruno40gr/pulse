'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { PageContainer } from './PageContainer'
import { PageHeader } from './PageHeader'
import { ModalStepper } from './ModalStepper'
import styles from './EnrollmentLayout.module.css'

/** Centered task geometry, distinct from full-width dashboard workspaces. */
export function EnrollmentLayout({ title, actions, steps, currentStep, onStepChange, completedSteps, width = 'focused', fullWidth = false, children }: {
  title: string
  actions?: ReactNode
  steps?: readonly string[]
  currentStep: number
  onStepChange?: (step: number) => void
  completedSteps?: readonly number[]
  width?: 'focused' | 'expanded'
  fullWidth?: boolean
  children: ReactNode
}) {
  const surface = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const heading = surface.current?.querySelector('h1')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  }, [currentStep])
  return <PageContainer><div ref={surface} className={styles.task} data-wizard-layout="" data-width={width} style={fullWidth ? { maxWidth: 'none' } : undefined}>
    <PageHeader title={title} right={actions} density="compact" singleLine />
    {steps && <nav aria-label="Enrollment steps" className={styles.steps}>
      <div className={styles.desktopSteps}><ModalStepper steps={steps} currentStep={currentStep} onStepChange={onStepChange} completedSteps={completedSteps} /></div>
      <div className={styles.mobileSteps}><ModalStepper compact steps={steps} currentStep={currentStep} onStepChange={onStepChange} completedSteps={completedSteps} /></div>
    </nav>}
    {children}
  </div></PageContainer>
}