'use client'
import type { OpsPlayerCard } from './WellnessFlipCard'
export default function OpsRhrPanel({
  surveyId,
  players,
}: {
  surveyId: string
  players: OpsPlayerCard[]
}) {
  return (
    <section
      className="ops-focus-panel"
      aria-label="Resting heart rate results"
    >
      <div className="ops-focus-heading">
        <div>
          <h2>Resting heart rate</h2>
          <span>
            15-second camera estimates · Compare the same resting position
          </span>
        </div>
        <a href={`/admin/surveys/${surveyId}/results`}>
          Survey results &amp; CSV
        </a>
      </div>
      <div className="ops-focus-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Resting HR</th>
              <th>Position</th>
              <th>Measured</th>
            </tr>
          </thead>
          <tbody>
            {players.flatMap((p) =>
              p.restingHr?.length
                ? p.restingHr.map((r) => (
                    <tr key={`${p.id}:${r.questionId}`}>
                      <td>
                        {p.firstName} {p.lastName}
                      </td>
                      <td>{r.bpm} bpm<small>{r.label}</small></td>
                      <td>{r.position}</td>
                      <td>{new Date(r.measuredAt).toLocaleString('en-GB')}</td>
                    </tr>
                  ))
                : [
                    <tr key={p.id}>
                      <td>
                        {p.firstName} {p.lastName}
                      </td>
                      <td colSpan={3}>Pending</td>
                    </tr>,
                  ],
            )}
          </tbody>
        </table>
      </div>
      <p>
        Device validation pending. Resting HR is separate from the wellness
        readiness score.
      </p>
    </section>
  )
}
