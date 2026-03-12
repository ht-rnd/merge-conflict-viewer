import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function Features() {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      {[
        {
          title: "Side-by-side Diff",
          description:
            "Visual comparison of two JSON objects with clearly highlighted additions, deletions, and changes.",
        },
        {
          title: "Interactive Resolution",
          description:
            "Choose which version to keep for each conflicting field with a single click.",
        },
        {
          title: "Field Deletion",
          description:
            "Remove unwanted fields entirely from the merged result directly from the diff view.",
        },
        {
          title: "Bulk Operations",
          description:
            "Apply all changes from one side at once with a single button click.",
        },
        {
          title: "TypeScript Support",
          description:
            "Fully typed API with exported types for all props, callbacks, and data structures.",
        },
        {
          title: "Real-time Preview",
          description:
            "See the merged JSON result update instantly as you make conflict resolution choices.",
        },
      ].map((feature) => (
        <Card key={feature.title} className="max-w-[400px]">
          <CardHeader>
            <CardTitle>{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{feature.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
