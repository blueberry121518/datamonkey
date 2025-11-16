import { useState, useEffect, useRef } from 'react'

interface MockAction {
  id: string
  action_type: string
  status: 'pending' | 'success' | 'failed'
  details: Record<string, any>
  created_at: string
}

interface UseMockAgentExecutionProps {
  agentId: string | null
  agent: any | null
  isActive: boolean
  onInventoryUpdate?: (csvData: any[]) => void
  onAgentUpdate?: (updates: { spent: number; quantity_acquired: number }) => void
}

export function useMockAgentExecution({ 
  agentId, 
  agent, 
  isActive,
  onInventoryUpdate,
  onAgentUpdate
}: UseMockAgentExecutionProps) {
  const [mockActions, setMockActions] = useState<MockAction[]>([])
  // Track which agent has already executed to prevent re-running
  const executedAgentIdRef = useRef<string | null>(null)
  const isExecutingRef = useRef<boolean>(false)
  
  // Export function to check if mock is executing for this agent
  const isMockExecuting = () => {
    return executedAgentIdRef.current === agentId && isExecutingRef.current
  }

  useEffect(() => {
    // Reset execution tracking when modal closes or agent changes
    if (!isActive || !agentId) {
      if (executedAgentIdRef.current === agentId) {
        // Allow re-execution when modal reopens
        executedAgentIdRef.current = null
        isExecutingRef.current = false
      }
      return
    }

    // Wait for agent to load - if agent is null, we'll wait
    if (!agent) {
      // Wait for agent to load
      const timeout = setTimeout(() => {
        // This will re-trigger the effect once agent loads
      }, 100)
      return () => clearTimeout(timeout)
    }

    // If agent exists and status is not active, don't run
    if (agent.status !== 'active') {
      return
    }

    // Only start execution once per agent ID - prevent loops
    if (executedAgentIdRef.current === agentId) {
      // Already executed or executing for this agent
      return
    }

    // Agent is loaded and active - start execution
    if (agent.status === 'active') {
      // Mark this agent as executed and mark execution as in progress
      executedAgentIdRef.current = agentId
      isExecutingRef.current = true
      
      // Simulate agent execution flow
      const simulateExecution = async () => {
        const now = Date.now()
        
        // Step 1: Looking for data
        await delay(500)
        addAction({
          id: `mock-${now}-1`,
          action_type: 'discovering_datasets',
          status: 'success',
          details: { message: 'Looking for data...' },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 2: Found producer
        await delay(1500)
        addAction({
          id: `mock-${now}-2`,
          action_type: 'dataset_found',
          status: 'success',
          details: { 
            count: 1,
            datasets: [{ name: 'Monkey Data Producer' }]
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 3: x402 Payment received for sample (5 records)
        await delay(1000)
        const sampleRecords = 5
        const sampleCost = sampleRecords * 0.002 // $0.01 for 5 records
        addAction({
          id: `mock-${now}-3`,
          action_type: 'payment_402_received',
          status: 'success',
          details: { 
            amount: sampleCost.toFixed(3), // 5 records * $0.002 = $0.01
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 4: Signing payment for sample
        await delay(1000)
        addAction({
          id: `mock-${now}-4`,
          action_type: 'payment_signing',
          status: 'success',
          details: {},
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 5: Payment sent for sample
        await delay(800)
        addAction({
          id: `mock-${now}-5`,
          action_type: 'payment_sent',
          status: 'success',
          details: { 
            amount: sampleCost.toFixed(3)
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 6: Payment verified for sample
        await delay(800)
        addAction({
          id: `mock-${now}-6`,
          action_type: 'payment_verified',
          status: 'success',
          details: {},
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 7: Sample received (5 records)
        await delay(800)
        addAction({
          id: `mock-${now}-7`,
          action_type: 'sample_received',
          status: 'success',
          details: { 
            sample_count: sampleRecords
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 8: Verifying quality (5 second pause)
        await delay(5000)
        const qualityScore = 0.92 // Over 0.9
        addAction({
          id: `mock-${now}-8`,
          action_type: 'quality_assessment_complete',
          status: 'success',
          details: { 
            overall_score: qualityScore,
            passed_threshold: true
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 9: Requesting remaining data (95 records)
        await delay(1000)
        const remainingRecords = 95 // 100 total - 5 sample
        addAction({
          id: `mock-${now}-9`,
          action_type: 'requesting_data',
          status: 'success',
          details: { 
            quantity: remainingRecords
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 10: x402 Payment received for remaining records
        await delay(1000)
        const remainingCost = remainingRecords * 0.002 // $0.19 for 95 records
        addAction({
          id: `mock-${now}-10`,
          action_type: 'payment_402_received',
          status: 'success',
          details: { 
            amount: remainingCost.toFixed(3), // 95 records * $0.002 = $0.19
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 11: Signing payment for remaining records
        await delay(1000)
        addAction({
          id: `mock-${now}-11`,
          action_type: 'payment_signing',
          status: 'success',
          details: {},
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 12: Payment sent for remaining records
        await delay(800)
        addAction({
          id: `mock-${now}-12`,
          action_type: 'payment_sent',
          status: 'success',
          details: { 
            amount: remainingCost.toFixed(3)
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 13: Payment verified for remaining records
        await delay(1000)
        addAction({
          id: `mock-${now}-13`,
          action_type: 'payment_verified',
          status: 'success',
          details: {},
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 14: All data received (100 records total)
        await delay(1000)
        addAction({
          id: `mock-${now}-14`,
          action_type: 'data_received',
          status: 'success',
          details: { 
            quantity: 100 // Total 100 records (5 sample + 95 remaining)
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Step 15: Purchase complete
        await delay(800)
        const totalCost = sampleCost + remainingCost // $0.01 + $0.19 = $0.20
        addAction({
          id: `mock-${now}-15`,
          action_type: 'purchase_complete',
          status: 'success',
          details: { 
            quantity: 100,
            amount: totalCost.toFixed(3), // Total: $0.01 (sample) + $0.19 (remaining) = $0.20
            dataset_name: 'Monkey Data Producer'
          },
          created_at: new Date(Date.now()).toISOString(),
        })

        // Load actual CSV data and add to inventory
        const csvData = await loadCSVData()
        if (onInventoryUpdate && csvData.length > 0) {
          onInventoryUpdate(csvData)
        }

        // Update agent budget and quantity acquired
        // Total spent: $0.01 (5 sample) + $0.19 (95 remaining) = $0.20
        // Quantity: 100 records (5 sample + 95 remaining)
        if (onAgentUpdate && agent) {
          const currentSpent = agent.spent || 0
          
          onAgentUpdate({
            spent: currentSpent + totalCost, // Add $0.20 to spent
            quantity_acquired: 100, // Set to 100/100
          })
        }
      }

      simulateExecution().finally(() => {
        // Mark execution as complete (but keep executedAgentIdRef to prevent re-running during execution)
        isExecutingRef.current = false
      })
    }
  }, [agentId, agent?.status, agent, isActive]) // Re-run when agent loads, status changes, or modal opens/closes

  const addAction = (action: MockAction) => {
    setMockActions(prev => [...prev, action])
  }

  const reset = () => {
    setMockActions([])
    executedAgentIdRef.current = null
    isExecutingRef.current = false
    // Clear mock data from localStorage
    if (agentId) {
      localStorage.removeItem(`agent_${agentId}_mock`)
    }
    if (onInventoryUpdate) {
      onInventoryUpdate([])
    }
  }

  return { mockActions, reset, isMockExecuting }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadCSVData(): Promise<any[]> {
  try {
    // Load the CSV file from public folder
    const response = await fetch('/monkey_data.csv')
    if (!response.ok) {
      console.error('Failed to load CSV file')
      return []
    }
    
    const csvText = await response.text()
    const lines = csvText.trim().split('\n')
    
    if (lines.length < 2) {
      return []
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim())
    
    // Parse data rows
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      // Add an id field for React keys
      row.id = `monkey-${i}`
      data.push(row)
    }
    
    return data
  } catch (error) {
    console.error('Error loading CSV data:', error)
    return []
  }
}

