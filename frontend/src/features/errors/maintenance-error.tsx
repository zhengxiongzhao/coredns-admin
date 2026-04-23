import { Wrench } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function MaintenanceError() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Wrench className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Maintenance in Progress</CardTitle>
          <CardDescription>
            The system is currently undergoing maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            We'll be back shortly. Thank you for your patience.
          </p>
          <p className="text-sm text-muted-foreground">
            Please check back in a few minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}