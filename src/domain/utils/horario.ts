export class Horario {
    constructor(
        public hours: number,
        public minutes: number,
    ) {
        if (hours < 0 || hours > 23) throw new Error('Hora inválida');
        if (minutes < 0 || minutes > 59) throw new Error('Minuto inválido');
    }

    format() {
        return `${this.hours}`.padStart(2, "0")+ ":"+`${this.minutes}`.padStart(2, "0")
    }

    static parse(value: string) {
        const parsed = value.split(":");
        if (!parsed.length) {
            return new Horario(0, 0);
        }

        return new Horario(Number(parsed[0]), Number(parsed[1]))
    }
}