'use client'

import { useState } from 'react'
import SchoolSetup from '/Users/brunowong/pulse-odeon-integration/app/content-studio-prototype/school-setup/SchoolSetup'
import { createDemoSetup } from '/Users/brunowong/pulse-odeon-integration/lib/odeon-demo-setup'

export default function SetupPreview() {
  const [data] = useState(createDemoSetup)
  return <SchoolSetup demo configuredData={data} />
}