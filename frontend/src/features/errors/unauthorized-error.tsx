import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@tanstack/react-router'

export function UnauthorisedError() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Shield className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">Unauthorized</CardTitle>
          <CardDescription>
            You need to be logged in to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            Please sign in to continue.
          </p>
          <Link to="/sign-in">
            <Button>
              Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}