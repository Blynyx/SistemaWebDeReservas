import { formatLocalTime } from '../utils/dateTime.js';

export function AvailabilityResults({
  availability,
  selectedSlot,
  disabled = false,
  onSelectSlot,
}) {
  if (!availability) {
    return null;
  }

  const professionals = Array.isArray(availability.professionals)
    ? availability.professionals
    : [];
  const hasAnySlot = professionals.some(
    (p) => Array.isArray(p.slots) && p.slots.length > 0
  );

  if (professionals.length === 0 || !hasAnySlot) {
    return (
      <section className="booking-dialog__availability" aria-label="Horarios disponibles">
        <p className="panel-status">
          No hay horarios disponibles para la fecha seleccionada.
        </p>
      </section>
    );
  }

  return (
    <section className="booking-dialog__availability" aria-label="Horarios disponibles">
      {professionals.map((professional) => {
        const slots = Array.isArray(professional.slots) ? professional.slots : [];
        if (slots.length === 0) {
          return null;
        }

        return (
          <section key={professional.id} className="booking-professional">
            <h3>{professional.name}</h3>
            <div
              className="booking-slots"
              role="radiogroup"
              aria-label={`Horarios de ${professional.name}`}
            >
              {slots.map((slot) => {
                const slotKey = `${professional.id}|${slot.startAt}`;
                const isSelected =
                  selectedSlot?.professionalId === professional.id &&
                  selectedSlot?.startAt === slot.startAt;

                return (
                  <label
                    key={slotKey}
                    className={
                      isSelected ? 'booking-slot booking-slot--selected' : 'booking-slot'
                    }
                  >
                    <input
                      type="radio"
                      name="client-booking-slot"
                      value={slotKey}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() =>
                        onSelectSlot({
                          professionalId: professional.id,
                          professionalName: professional.name,
                          startAt: slot.startAt,
                          endAt: slot.endAt,
                        })
                      }
                    />
                    <span>
                      {formatLocalTime(slot.startAt)} – {formatLocalTime(slot.endAt)}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
